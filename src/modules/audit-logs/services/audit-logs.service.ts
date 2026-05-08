import BaseService from '@shared/common/base-service';
import auditLogsRepository from '@modules/audit-logs/repositories/audit-logs.repository';
import auditLogSchema from '@modules/audit-logs/schemas/audit-log.schema';
import type { AnyRecord } from '@app-types/common';
import { logger } from '@utils/logger';

type AuditLogPayload = {
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
};

const MAX_QUEUE_SIZE = 5000;

class AuditLogsService extends BaseService {
  private queue: Array<AuditLogPayload & { createdAt: string }> = [];
  private processing = false;

  constructor() {
    super('audit_logs', auditLogsRepository);
  }

  getSchema() {
    return auditLogSchema;
  }

  async log(data: AuditLogPayload) {
    try {
      if (this.queue.length >= MAX_QUEUE_SIZE) {
        this.queue.shift();
        logger.warn('Hàng đợi nhật ký hệ thống đã đầy. Đã loại bỏ nhật ký cũ nhất.', 'AuditLog');
      }

      this.queue.push({
        ...data,
        createdAt: new Date().toISOString(),
      });

      this.processQueue();
      return { success: true, queued: true };
    } catch (error) {
      logger.error('Lỗi khi thêm nhật ký hệ thống vào hàng đợi', 'AuditLog', error);
      // We don't want to throw error here as it might break the main business logic
    }
  }

  private processQueue() {
    if (this.processing) return;

    this.processing = true;
    setImmediate(() => {
      void this.drainQueue();
    });
  }

  private async drainQueue() {
    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) continue;

      try {
        await super.create(item);
      } catch (error) {
        logger.error('Lỗi khi ghi nhận hoạt động', 'AuditLog', error);
      }
    }

    this.processing = false;
    if (this.queue.length > 0) {
      this.processQueue();
    }
  }

  async getPage(options: AnyRecord = {}) {
    const rawPage = Number(options.page || options._page || 1);
    const rawLimit = Number(options.limit || options._limit || 10);
    const page = Number.isFinite(rawPage) ? Math.max(Math.floor(rawPage), 1) : 1;
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.floor(rawLimit), 1), 100) : 10;

    return await this.findAll({
      ...options,
      page,
      limit,
      sort: 'createdAt',
      order: 'desc',
    });
  }
}

export default new AuditLogsService();
