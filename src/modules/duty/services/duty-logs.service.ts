import dutyLogsRepository from '@modules/duty/repositories/duty-logs.repository';
import { Identifier, normalizeId } from './duty-utils';

class DutyLogsService {
  async log(
    type: string,
    action: string,
    details: string,
    performerId: Identifier,
    userId?: Identifier,
    slotId?: Identifier,
    requestId?: Identifier,
  ) {
    return await dutyLogsRepository.create({
      type,
      action,
      slotId: slotId ? normalizeId(slotId) : 0,
      requestId: requestId ? normalizeId(requestId) : undefined,
      userId: userId ? normalizeId(userId) : normalizeId(performerId),
      performerId: normalizeId(performerId),
      details,
      createdAt: new Date(),
    });
  }

  async getUserLogs(userId: Identifier, limit = 10) {
    const id = normalizeId(userId);
    return await dutyLogsRepository.findMany({
      userId: id,
      _limit: limit,
      _sort: 'createdAt:DESC',
    });
  }
}

export default new DutyLogsService();
