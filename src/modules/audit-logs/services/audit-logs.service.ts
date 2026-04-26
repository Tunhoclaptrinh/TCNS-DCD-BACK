import BaseService from '@shared/common/base-service';
import auditLogsRepository from '@modules/audit-logs/repositories/audit-logs.repository';
import auditLogSchema from '@modules/audit-logs/schemas/audit-log.schema';
import type { AnyRecord } from '@app-types/common';

class AuditLogsService extends BaseService {
  constructor() {
    super('audit_logs', auditLogsRepository);
  }

  getSchema() {
    return auditLogSchema;
  }

  async log(data: {
    userId: number;
    action: string;
    module: string;
    description?: string;
    resourceId?: string;
    dataBefore?: AnyRecord;
    dataAfter?: AnyRecord;
    ipAddress?: string;
    userAgent?: string;
    status?: 'success' | 'failure';
    errorMessage?: string;
  }) {
    try {
      return await this.create({
        ...data,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // We don't want to throw error here as it might break the main business logic
    }
  }

  async getLogs(options: AnyRecord = {}) {
    return await this.findAll(options);
  }
}

export default new AuditLogsService();
