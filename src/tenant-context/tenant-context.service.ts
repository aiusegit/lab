import { Injectable, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.REQUEST })
export class TenantContextService {
  private currentNamespaceId: string | null = null;
  private currentDbName: string | null = null;

  setTenantDetails(namespaceId: string, dbName: string) {
    this.currentNamespaceId = namespaceId;
    this.currentDbName = dbName;
    console.log(`TenantContextService: Set context to ns: ${namespaceId}, db: ${dbName}`);
  }

  getTenantDetails(): { namespaceId: string | null; dbName: string | null } {
    return {
      namespaceId: this.currentNamespaceId,
      dbName: this.currentDbName,
    };
  }

  getNamespaceId(): string | null {
    return this.currentNamespaceId;
  }

  getDbName(): string | null {
    return this.currentDbName;
  }
}
