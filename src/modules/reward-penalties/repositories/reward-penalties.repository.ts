import BaseRepository from '@shared/repositories/base.repository';
import type { Identifier } from '@app-types/common';

class RewardPenaltiesRepository extends BaseRepository {
  constructor() {
    super('reward_penalties');
  }

  async findByUserId(userId: Identifier) {
    return await this.findMany({ userId });
  }

  async findByCreatorId(createdBy: Identifier) {
    return await this.findMany({ createdBy });
  }
}

export default new RewardPenaltiesRepository();
