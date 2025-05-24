import { Injectable, Inject, UnauthorizedException, InternalServerErrorException, ConflictException, Logger, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import Surreal from 'surrealdb.js';
import * as bcrypt from 'bcrypt';
import { TENANT_SURREAL_CONNECTION } from '../tenant-surreal/tenant-surreal.module';
import { TenantContextService } from '../tenant-context/tenant-context.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';

@Injectable({ scope: Scope.REQUEST }) // Request scope because it depends on request-scoped TenantSurrealService/TenantContextService
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(TENANT_SURREAL_CONNECTION) private readonly tenantDb: Surreal | null,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly tenantContextService: TenantContextService,
  ) {
    if (!this.tenantDb) {
      this.logger.error('AuthService initialized without a tenant DB connection. This should only happen for non-tenant routes.');
      // Depending on how AuthService is used, this might be an issue.
      // For instance, if a global guard tries to use AuthService without tenant context.
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async register(registerUserDto: RegisterUserDto): Promise<{ message: string; userId: string }> {
    if (!this.tenantDb) {
      this.logger.error('Cannot register user: Tenant database connection is not available.');
      throw new InternalServerErrorException('Tenant context not established for registration.');
    }

    const { name, email, password } = registerUserDto;
    const { namespaceId, dbName } = this.tenantContextService.getTenantDetails();
    const tenantId = this.tenantContextService.getTenantDetails().namespaceId?.replace('tenant_',''); // Or however you store business tenant_id

    this.logger.log(`Registering user ${email} for tenant ns=${namespaceId}, db=${dbName}`);

    try {
      // Check if user already exists
      const existingUser = await this.tenantDb.query<[[{ count: number }]]>(
        'SELECT count() FROM users WHERE email = $email GROUP ALL',
        { email },
      );
      if (existingUser[0]?.result[0]?.count > 0) {
        this.logger.warn(`Registration attempt for existing email: ${email}`);
        throw new ConflictException('User with this email already exists.');
      }

      const hashedPassword = await this.hashPassword(password);

      // The 'crm_user_scope' SIGNUP clause handles user creation.
      // We need to pass variables expected by the scope's SIGNUP query.
      // The current 'crm_user_scope' is:
      // SIGNUP (CREATE users SET email = $email, password = crypto::argon2::generate($pass), role = 'user', status = 'pending', tenant_id = $tenant_id)
      // It uses argon2 for password, so we should align or change scope. For now, let's create directly.
      
      const userToCreate = {
        email,
        password: hashedPassword, // Storing bcrypt hash, scope needs to align or we use direct creation
        name,
        role: 'user',
        status: 'active', // Or 'pending' if email verification is implemented
        tenant_id: tenantId, // Store the business tenant_id for reference
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const createdUser = await this.tenantDb.create('users', userToCreate);
      
      const userId = Array.isArray(createdUser) ? createdUser[0].id : createdUser.id;
      this.logger.log(`User ${email} registered successfully with ID: ${userId}`);
      return { message: 'User registered successfully', userId };

    } catch (error) {
      this.logger.error(`Error during user registration for ${email}: ${error.message}`, error.stack);
      if (error instanceof ConflictException) throw error;
      throw new InternalServerErrorException('Failed to register user.');
    }
  }

  async login(loginUserDto: LoginUserDto): Promise<{ accessToken: string }> {
    if (!this.tenantDb) {
      this.logger.error('Cannot login user: Tenant database connection is not available.');
      throw new InternalServerErrorException('Tenant context not established for login.');
    }

    const { email, password } = loginUserDto;
    const { namespaceId, dbName } = this.tenantContextService.getTenantDetails();
    const businessTenantId = this.tenantContextService.getTenantDetails().namespaceId?.replace('tenant_',''); // Assuming this logic

    this.logger.log(`Attempting login for user ${email} in tenant ns=${namespaceId}, db=${dbName}`);

    try {
      // SurrealDB's signin with scope is preferred.
      // The scope `crm_user_scope` is defined as:
      // SIGNIN (SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(password, $pass) AND status = "active");
      // This means password check is done by SurrealDB using argon2.
      // If we stored passwords with bcrypt, this SIGNIN query won't work directly.
      // Option 1: Change user table to store argon2 hashes (recommended for SurrealDB scopes).
      // Option 2: Fetch user and compare password in Node.js (less ideal, bypasses scope benefits).

      // For now, let's assume we will align passwords with Argon2 for the scope to work.
      // Or, if direct bcrypt comparison:
      const users = await this.tenantDb.select<any[]>(`users:(WHERE email = '${email}')`);
      if (!users || users.length === 0) {
        this.logger.warn(`Login failed: User ${email} not found.`);
        throw new UnauthorizedException('Invalid credentials.');
      }
      const user = users[0]; // Assuming email is unique
      
      const isPasswordMatching = await bcrypt.compare(password, user.password);
      if (!isPasswordMatching) {
        this.logger.warn(`Login failed: Password mismatch for user ${email}.`);
        throw new UnauthorizedException('Invalid credentials.');
      }

      if (user.status !== 'active') {
        this.logger.warn(`Login failed: User ${email} is not active (status: ${user.status}).`);
        throw new UnauthorizedException(`User account is ${user.status}.`);
      }
      
      this.logger.log(`User ${email} authenticated successfully. User ID: ${user.id}`);

      // If using SurrealDB's signin which returns a token:
      // const token = await this.tenantDb.signin({
      //   NS: namespaceId,
      //   DB: dbName,
      //   SC: 'crm_user_scope', // The scope defined in tenant provisioning
      //   email: email,
      //   pass: password, // Raw password, SurrealDB handles hashing comparison via scope
      //   // Pass any other variables needed by the scope's SIGNIN query, if any.
      // });
      // This token is a SurrealDB session token, NOT a JWT for client-side use.
      // We need to generate our own JWT.

      const jwtPayload = {
        sub: user.id, // User's SurrealDB record ID
        email: user.email,
        // Important: Include tenant identifying information in the JWT
        // So that JwtStrategy can set TenantContextService correctly on subsequent requests.
        ns: namespaceId, // Tenant's namespace
        db: dbName,      // Tenant's database name
        tid: businessTenantId, // The business tenant_id
        role: user.role, // Include user role if needed
      };
      
      const accessToken = this.jwtService.sign(jwtPayload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        // expiresIn: this.configService.get<string>('JWT_EXPIRES_IN') || '1h', // Optional: make configurable
      });

      this.logger.log(`JWT generated for user ${email}`);
      return { accessToken };

    } catch (error) {
      this.logger.error(`Error during login for ${email}: ${error.message}`, error.stack);
      if (error instanceof UnauthorizedException) throw error;
      throw new InternalServerErrorException('Login failed.');
    }
  }
}
