import BaseService from '@shared/common/base-service';
import dutyLogsRepository from '@modules/duty/repositories/duty-logs.repository';
import { Identifier, GenericRecord, normalizeId } from './duty-utils';

class DutyLogsService extends BaseService {
  constructor() {
    super('duty_logs', dutyLogsRepository);
  }

  async log(
    type: string,
    action: string,
    details: string,
    performerId: Identifier,
    userId?: Identifier,
    slotId?: Identifier,
    requestId?: Identifier,
  ) {
    return await this.create({
      type,
      action,
      details,
      performerId,
      userId: userId || performerId,
      slotId: slotId || 0,
      requestId,
    });
  }

  async beforeCreate(data: GenericRecord) {
    const base = await super.beforeCreate(data);
    return {
      ...base,
      slotId: data.slotId ? normalizeId(data.slotId) : 0,
      requestId: data.requestId ? normalizeId(data.requestId) : undefined,
      userId: normalizeId(data.userId || data.targetUserId || data.performerId),
      performerId: normalizeId(data.performerId),
    };
  }

  async getUserLogs(userId: Identifier, limit = 10) {
    const id = normalizeId(userId);
    return await this.findAll({
      filter: { userId: id },
      limit,
      sort: 'createdAt',
      order: 'desc',
    });
  }
}

export default new DutyLogsService();
