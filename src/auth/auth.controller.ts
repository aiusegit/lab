import { Controller, Post, Body, UseGuards, Logger, Scope, ValidationPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
// import { JwtAuthGuard } from './guards/jwt-auth.guard'; // For protected routes, not login/register

// The AuthController itself doesn't need to be request-scoped if AuthService is request-scoped
// and handles the tenant context properly.
// However, applying TenantMiddleware before this controller is crucial.
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(new ValidationPipe()) registerUserDto: RegisterUserDto) {
    this.logger.log(`Received request to register user: ${registerUserDto.email}`);
    try {
      const result = await this.authService.register(registerUserDto);
      this.logger.log(`User ${registerUserDto.email} registered successfully.`);
      return result;
    } catch (error) {
      this.logger.error(`Error in AuthController during registration for ${registerUserDto.email}: ${error.message}`, error.stack);
      throw error; // Let NestJS default error handling take over
    }
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body(new ValidationPipe()) loginUserDto: LoginUserDto) {
    this.logger.log(`Received request to login user: ${loginUserDto.email}`);
    try {
      const result = await this.authService.login(loginUserDto);
      this.logger.log(`User ${loginUserDto.email} logged in successfully.`);
      return result;
    } catch (error) {
      this.logger.error(`Error in AuthController during login for ${loginUserDto.email}: ${error.message}`, error.stack);
      throw error; // Let NestJS default error handling take over
    }
  }

  // Example of a protected route that would require a valid JWT and tenant context
  // @UseGuards(JwtAuthGuard) // Your JWT guard
  // @Get('profile')
  // getProfile(@Request() req) {
  //   // req.user would be populated by JwtStrategy, including tenant details
  //   this.logger.log(`Accessing profile for user: ${req.user.email} in tenant: ${req.user.namespace_id}`);
  //   return { message: 'This is a protected route', user: req.user };
  // }
}
