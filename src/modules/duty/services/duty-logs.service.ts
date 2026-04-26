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
}

export default new DutyLogsService();
