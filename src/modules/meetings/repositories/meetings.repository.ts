import BaseRepository from '@shared/repositories/base.repository';
import type { Identifier } from '@app-types/common';

class MeetingsRepository extends BaseRepository {
  constructor() {
    super('meetings');
  }

  async findByCreatorId(createdBy: Identifier) {
    return await this.findMany({ createdBy });
  }

  async findByParticipantId(userId: Identifier) {
    return await this.findMany({ participantIds: userId });
  }
}

export default new MeetingsRepository();
