import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Surreal from 'surrealdb.js';

@Injectable()
export class MasterSurrealService implements OnModuleInit, OnModuleDestroy {
  private db: Surreal;

  constructor(private configService: ConfigService) {
    this.db = new Surreal();
  }

  async onModuleInit() {
    try {
      const dbUrl = this.configService.get<string>('MASTER_SURREALDB_URL');
      const dbUser = this.configService.get<string>('MASTER_SURREALDB_USER');
      const dbPass = this.configService.get<string>('MASTER_SURREALDB_PASS');
      const dbNs = this.configService.get<string>('MASTER_SURREALDB_NS');
      const dbName = this.configService.get<string>('MASTER_SURREALDB_DB');

      if (!dbUrl) {
        throw new Error('MASTER_SURREALDB_URL is not defined in environment variables');
      }

      await this.db.connect(dbUrl);
      if (dbUser && dbPass) {
        await this.db.signin({ user: dbUser, pass: dbPass });
      }
      if (dbNs && dbName) {
        await this.db.use({ ns: dbNs, db: dbName });
        console.log(`MasterSurrealService connected to ns: ${dbNs}, db: ${dbName}`);
      } else {
        console.warn('MASTER_SURREALDB_NS or MASTER_SURREALDB_DB is not defined. Not using specific namespace/database for master connection.');
      }
      
      // Define the 'tenants' table schema
      await this.defineTenantsTable();

    } catch (error) {
      console.error('Failed to connect to Master SurrealDB:', error);
      throw error;
    }
  }

  private async defineTenantsTable() {
    const query = `
      DEFINE TABLE tenants SCHEMAFULL;
      DEFINE FIELD tenant_id ON tenants TYPE string ASSERT $value != NONE AND $value != "";
      DEFINE INDEX tenant_id_unique ON tenants COLUMNS tenant_id UNIQUE;
      DEFINE FIELD name ON tenants TYPE string ASSERT $value != NONE AND $value != "";
      DEFINE FIELD namespace_id ON tenants TYPE string ASSERT $value != NONE AND $value != "";
      DEFINE FIELD db_name ON tenants TYPE string ASSERT $value != NONE AND $value != "";
      DEFINE FIELD status ON tenants TYPE string DEFAULT "active";
      DEFINE FIELD created_at ON tenants TYPE datetime DEFAULT time::now();
      DEFINE FIELD updated_at ON tenants TYPE datetime DEFAULT time::now() ON UPDATE time::now();
    `;
    try {
      await this.db.query(query);
      console.log('Defined tenants table schema in master database.');
    } catch (e) {
      // Ignore if table already exists or fields already exist
      if (e.message.includes('already exists') || e.message.includes('already defined')) {
        console.warn('Tenants table or fields already defined, skipping re-definition.');
      } else {
        console.error('Error defining tenants table:', e);
        throw e;
      }
    }
  }

  async onModuleDestroy() {
    await this.db.close();
  }

  getDb() {
    return this.db;
  }
}
