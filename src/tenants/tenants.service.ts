import { Injectable, InternalServerErrorException, ConflictException, Logger } from '@nestjs/common';
import { MasterSurrealService } from '../master-surreal/master-surreal.service';
import { Tenant, CreateTenantDto, TenantResponseDto } from './entities/tenant.entity';
import Surreal from 'surrealdb.js';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly tenantSurrealUrl: string;
  private readonly tenantRootUser: string;
  private readonly tenantRootPass: string;

  constructor(
    private readonly masterSurrealService: MasterSurrealService,
    private readonly configService: ConfigService,
  ) {
    this.tenantSurrealUrl = this.configService.get<string>('TENANT_SURREALDB_URL');
    this.tenantRootUser = this.configService.get<string>('TENANT_SURREALDB_ROOT_USER');
    this.tenantRootPass = this.configService.get<string>('TENANT_SURREALDB_ROOT_PASS');

    if (!this.tenantSurrealUrl || !this.tenantRootUser || !this.tenantRootPass) {
      this.logger.error('Tenant SurrealDB connection details (URL, ROOT_USER, ROOT_PASS) are not fully configured.');
      throw new InternalServerErrorException('Tenant DB configuration is incomplete.');
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  async createTenant(createTenantDto: CreateTenantDto): Promise<TenantResponseDto> {
    const { tenant_id, name, adminUserEmail, adminUserPass } = createTenantDto;
    const masterDb = this.masterSurrealService.getDb();

    this.logger.log(`Attempting to create tenant with tenant_id: ${tenant_id}`);

    // Check if tenant_id already exists in master
    const existingTenant = await masterDb.select(`tenants:${tenant_id}`);
    if (existingTenant && existingTenant.tenant_id === tenant_id) {
      this.logger.warn(`Tenant with tenant_id ${tenant_id} already exists.`);
      throw new ConflictException(`Tenant with tenant_id ${tenant_id} already exists.`);
    }
    
    // Check by unique index just in case (though select by ID is primary)
    const existingByField = await masterDb.query<[Tenant[]]>(
        `SELECT * FROM tenants WHERE tenant_id = $id`, 
        { id: tenant_id }
    );
    if (existingByField[0]?.result?.length > 0) {
        this.logger.warn(`Tenant with tenant_id ${tenant_id} already exists (found by field).`);
        throw new ConflictException(`Tenant with tenant_id ${tenant_id} already exists.`);
    }


    const namespace_id = `tenant_${uuidv4().replace(/-/g, '_')}`;
    const db_name = 'app_db'; // Standardized DB name for tenants

    const newTenantRecord: Omit<Tenant, 'id' | 'created_at' | 'updated_at'> = {
      tenant_id,
      name,
      namespace_id,
      db_name,
      status: 'active',
    };

    let createdTenantInMaster: Tenant;
    try {
      // Create tenant record in master DB
      // We use CREATE tenants CONTENT ... to let SurrealDB handle the ID part if tenant_id is not meant to be the record ID suffix
      // Or, if tenant_id IS the suffix, use CREATE tenants:${tenant_id} ...
      // For simplicity and to use our business ID as the record key part:
      const result = await masterDb.create<Tenant>(`tenants:${tenant_id}`, newTenantRecord);
      createdTenantInMaster = Array.isArray(result) ? result[0] : result; // create can return array
      this.logger.log(`Tenant record created in master DB: ${createdTenantInMaster.id}`);
    } catch (error) {
      this.logger.error(`Error creating tenant ${tenant_id} in master DB: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Failed to create tenant record in master DB: ${error.message}`);
    }

    // Now, provision the tenant's namespace, database, tables, and admin user
    const tenantDb = new Surreal();
    try {
      await tenantDb.connect(this.tenantSurrealUrl);
      await tenantDb.signin({ user: this.tenantRootUser, pass: this.tenantRootPass });
      this.logger.log(`Connected to SurrealDB with root credentials for provisioning ns: ${namespace_id}`);

      await tenantDb.query(`DEFINE NAMESPACE ${namespace_id};`);
      this.logger.log(`Defined namespace: ${namespace_id}`);
      
      await tenantDb.query(`USE NS ${namespace_id}; DEFINE DATABASE ${db_name};`);
      this.logger.log(`Defined database ${db_name} in namespace ${namespace_id}`);

      await tenantDb.use({ ns: namespace_id, db: db_name });
      this.logger.log(`Switched to NS: ${namespace_id}, DB: ${db_name}`);

      // Define schemas (Users, Contacts, etc.)
      await this.defineTenantSchemas(tenantDb);
      this.logger.log(`Defined schemas for tenant ${tenant_id}`);

      // Create admin user for the new tenant
      const hashedPassword = await this.hashPassword(adminUserPass);
      const adminUser = {
        email: adminUserEmail,
        password: hashedPassword,
        name: 'Admin User',
        role: 'admin', // Or an array of roles: ['admin']
        status: 'active',
        tenant_id: tenant_id, // Store tenant_id for reference if needed within tenant DB
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await tenantDb.create('users', adminUser);
      this.logger.log(`Admin user created for tenant ${tenant_id} in their database.`);

      return {
        id: createdTenantInMaster.id,
        tenant_id: createdTenantInMaster.tenant_id,
        name: createdTenantInMaster.name,
        namespace_id: createdTenantInMaster.namespace_id,
        db_name: createdTenantInMaster.db_name,
        status: createdTenantInMaster.status,
        created_at: createdTenantInMaster.created_at,
      };
    } catch (error) {
      this.logger.error(`Error provisioning tenant ${tenant_id} (NS/DB/Schema/Admin): ${error.message}`, error.stack);
      // Rollback: Delete tenant record from master if provisioning fails
      await masterDb.delete(`tenants:${createdTenantInMaster.id || tenant_id}`);
      this.logger.log(`Rolled back: Deleted tenant record ${createdTenantInMaster.id || tenant_id} from master DB.`);
      throw new InternalServerErrorException(`Failed to provision tenant environment: ${error.message}`);
    } finally {
      await tenantDb.close();
    }
  }

  private async defineTenantSchemas(db: Surreal): Promise<void> {
    const queries = `
      -- Users Table
      DEFINE TABLE users SCHEMAFULL;
      DEFINE FIELD email ON users TYPE string ASSERT $value != NONE AND is::email($value);
      DEFINE INDEX user_email_unique ON users COLUMNS email UNIQUE;
      DEFINE FIELD password ON users TYPE string ASSERT $value != NONE;
      DEFINE FIELD name ON users TYPE string;
      DEFINE FIELD role ON users TYPE string OR array<string> DEFAULT "user"; -- Can be single role string or array of roles
      DEFINE FIELD status ON users TYPE string DEFAULT "pending" ASSERT $value IN ["pending", "active", "inactive", "suspended"];
      DEFINE FIELD tenant_id ON users TYPE string; -- To link back to the tenant record in master if ever needed cross-tenant
      DEFINE FIELD created_at ON users TYPE datetime DEFAULT time::now();
      DEFINE FIELD updated_at ON users TYPE datetime DEFAULT time::now() ON UPDATE time::now();

      -- User Login Scope
      DEFINE SCOPE crm_user_scope
        SESSION 14d -- Session duration
        SIGNUP (CREATE users SET email = $email, password = crypto::argon2::generate($pass), role = 'user', status = 'pending', tenant_id = $tenant_id)
        SIGNIN (SELECT * FROM users WHERE email = $email AND crypto::argon2::compare(password, $pass) AND status = "active");

      -- Contacts Table
      DEFINE TABLE contacts SCHEMAFULL;
      DEFINE FIELD name ON contacts TYPE string ASSERT $value != NONE;
      DEFINE FIELD email ON contacts TYPE string ASSERT is::email($value);
      DEFINE INDEX contact_email_unique ON contacts COLUMNS email UNIQUE;
      DEFINE FIELD phone ON contacts TYPE string;
      DEFINE FIELD company ON contacts TYPE string;
      DEFINE FIELD address ON contacts TYPE string;
      DEFINE FIELD created_by ON contacts TYPE record(users);
      DEFINE FIELD assigned_to ON contacts TYPE record(users);
      DEFINE FIELD created_at ON contacts TYPE datetime DEFAULT time::now();
      DEFINE FIELD updated_at ON contacts TYPE datetime DEFAULT time::now() ON UPDATE time::now();

      -- Deals Table
      DEFINE TABLE deals SCHEMAFULL;
      DEFINE FIELD title ON deals TYPE string ASSERT $value != NONE;
      DEFINE FIELD value ON deals TYPE number;
      DEFINE FIELD currency ON deals TYPE string DEFAULT "USD";
      DEFINE FIELD contact_id ON deals TYPE record(contacts);
      DEFINE FIELD stage_id ON deals TYPE record(sales_funnel_stages); -- Link to SalesFunnelStages
      DEFINE FIELD status ON deals TYPE string DEFAULT "open" ASSERT $value IN ["open", "won", "lost", "pending"];
      DEFINE FIELD created_by ON deals TYPE record(users);
      DEFINE FIELD assigned_to ON deals TYPE record(users);
      DEFINE FIELD expected_close_date ON deals TYPE datetime;
      DEFINE FIELD created_at ON deals TYPE datetime DEFAULT time::now();
      DEFINE FIELD updated_at ON deals TYPE datetime DEFAULT time::now() ON UPDATE time::now();

      -- Tasks Table
      DEFINE TABLE tasks SCHEMAFULL;
      DEFINE FIELD title ON tasks TYPE string ASSERT $value != NONE;
      DEFINE FIELD description ON tasks TYPE string;
      DEFINE FIELD due_date ON tasks TYPE datetime;
      DEFINE FIELD status ON tasks TYPE string DEFAULT "pending" ASSERT $value IN ["pending", "in_progress", "completed", "cancelled"];
      DEFINE FIELD priority ON tasks TYPE string DEFAULT "medium" ASSERT $value IN ["low", "medium", "high", "urgent"];
      DEFINE FIELD assigned_to ON tasks TYPE record(users);
      DEFINE FIELD related_deal ON tasks TYPE option<record(deals)>;
      DEFINE FIELD related_contact ON tasks TYPE option<record(contacts)>;
      DEFINE FIELD created_by ON tasks TYPE record(users);
      DEFINE FIELD created_at ON tasks TYPE datetime DEFAULT time::now();
      DEFINE FIELD updated_at ON tasks TYPE datetime DEFAULT time::now() ON UPDATE time::now();

      -- Kanban Columns Table (for visualizing deal stages or task boards)
      DEFINE TABLE kanban_columns SCHEMAFULL;
      DEFINE FIELD name ON kanban_columns TYPE string ASSERT $value != NONE;
      DEFINE FIELD board_type ON kanban_columns TYPE string ASSERT $value IN ["deals", "tasks"]; -- e.g. 'deals' or 'tasks'
      DEFINE FIELD order ON kanban_columns TYPE number; -- To maintain column order
      DEFINE FIELD created_at ON kanban_columns TYPE datetime DEFAULT time::now();

      -- Sales Funnel Stages Table
      DEFINE TABLE sales_funnel_stages SCHEMAFULL;
      DEFINE FIELD name ON sales_funnel_stages TYPE string ASSERT $value != NONE;
      DEFINE FIELD order ON sales_funnel_stages TYPE number; -- Order of the stage in the funnel
      DEFINE FIELD description ON sales_funnel_stages TYPE option<string>;
      DEFINE FIELD created_at ON sales_funnel_stages TYPE datetime DEFAULT time::now();
      DEFINE INDEX sales_funnel_stage_name_order_unique ON sales_funnel_stages COLUMNS name, order UNIQUE;
      
      -- WhatsApp Messages Table
      DEFINE TABLE whatsapp_messages SCHEMAFULL;
      DEFINE FIELD message_id ON whatsapp_messages TYPE string ASSERT $value != NONE; -- From WhatsApp provider
      DEFINE INDEX whatsapp_message_id_unique ON whatsapp_messages COLUMNS message_id UNIQUE;
      DEFINE FIELD sender_id ON whatsapp_messages TYPE string; -- WhatsApp ID of sender
      DEFINE FIELD receiver_id ON whatsapp_messages TYPE string; -- WhatsApp ID of receiver (could be a business number)
      DEFINE FIELD contact_link ON whatsapp_messages TYPE option<record(contacts)>; -- Link to an existing contact
      DEFINE FIELD content ON whatsapp_messages TYPE string;
      DEFINE FIELD message_type ON whatsapp_messages TYPE string DEFAULT "text" ASSERT $value IN ["text", "image", "audio", "video", "document", "template"];
      DEFINE FIELD status ON whatsapp_messages TYPE string ASSERT $value IN ["sent", "delivered", "read", "failed", "received"];
      DEFINE FIELD timestamp ON whatsapp_messages TYPE datetime; -- Timestamp from WhatsApp
      DEFINE FIELD direction ON whatsapp_messages TYPE string ASSERT $value IN ["inbound", "outbound"];
      DEFINE FIELD created_at ON whatsapp_messages TYPE datetime DEFAULT time::now();

      -- Example of a root user for tenant DB administration (optional, can be managed by root user used for provisioning)
      -- DEFINE LOGIN tenant_admin ON NAMESPACE TYPE ...
      -- DEFINE LOGIN tenant_user ON DATABASE TYPE ...
      -- DEFINE TOKEN tenant_token ON NAMESPACE TYPE ...
      -- DEFINE TOKEN tenant_token_db ON DATABASE TYPE ...
    `;
    try {
      await db.query(queries);
    } catch (e) {
        // Check if the error is about entities already existing
        if (e.message.includes("already exists") || e.message.includes("already defined")) {
            this.logger.warn(`One or more tenant schemas (tables, fields, indexes, scopes) already exist. Skipping re-definition. Error: ${e.message}`);
        } else {
            this.logger.error(`Error defining tenant schemas: ${e.message}`, e.stack);
            throw new InternalServerErrorException(`Failed to define tenant schemas: ${e.message}`);
        }
    }
  }

  async findTenantDetails(tenant_id: string): Promise<Tenant | null> {
    this.logger.log(`Looking up tenant details for tenant_id: ${tenant_id}`);
    const masterDb = this.masterSurrealService.getDb();
    try {
      // Assuming tenant_id is the unique part of the record ID, e.g., tenants:some_tenant_id
      const result = await masterDb.select<Tenant>(`tenants:${tenant_id}`);
      
      // If select returns an empty object for a non-existent record in some SurrealDB.js versions/configurations,
      // or if it returns null/undefined.
      if (!result || Object.keys(result).length === 0 || !result.tenant_id) {
          this.logger.warn(`Tenant with ID ${tenant_id} not found by direct select. Trying query.`);
          // Fallback to query if select behavior is not as expected or ID structure differs
          const queryResult = await masterDb.query<[Tenant[]]>(
            `SELECT * FROM tenants WHERE tenant_id = $id LIMIT 1`, 
            { id: tenant_id }
          );
          if (queryResult[0]?.result?.length > 0) {
            this.logger.log(`Tenant ${tenant_id} found via query.`);
            return queryResult[0].result[0];
          }
          this.logger.warn(`Tenant ${tenant_id} not found.`);
          return null;
      }
      this.logger.log(`Tenant ${tenant_id} found by select: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      this.logger.error(`Error finding tenant ${tenant_id}: ${error.message}`, error.stack);
      throw new InternalServerErrorException(`Error finding tenant: ${error.message}`);
    }
  }
}
