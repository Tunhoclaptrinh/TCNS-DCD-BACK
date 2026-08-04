import BaseRepository from '@shared/repositories/base.repository';
import type { Identifier } from '@app-types/common';

class DutySwapRequestsRepository extends BaseRepository {
  constructor() {
    super('duty_swap_requests');
  }

  async findPendingBySlotAndParticipants(dutySlotId: Identifier, requesterId: Identifier) {
    return await this.findOne({
      dutySlotId,
      requesterId,
      status: 'pending',
    });
  }
}

export default new DutySwapRequestsRepository();
