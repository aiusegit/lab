// Using an interface as SurrealDB.js primarily works with plain objects.
// We can use class-validator DTOs for input validation.

export interface Tenant {
  id?: string; // SurrealDB record ID, e.g., tenants:tenant_id_value
  tenant_id: string; // Our business identifier for the tenant
  name: string;
  namespace_id: string;
  db_name: string;
  status: 'active' | 'inactive' | 'suspended';
  created_at?: string; // ISO datetime string
  updated_at?: string; // ISO datetime string
}

// DTO for creating a tenant
export class CreateTenantDto {
  tenant_id: string;
  name: string;
  adminUserEmail: string;
  adminUserPass: string; // Consider validation (length, complexity)
}

// DTO for the response of creating a tenant (excluding sensitive info)
export class TenantResponseDto {
  id: string;
  tenant_id: string;
  name: string;
  namespace_id: string;
  db_name: string;
  status: string;
  created_at: string;
}
