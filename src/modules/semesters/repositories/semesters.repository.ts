import BaseRepository from '@shared/repositories/base.repository';
import type { AnyRecord } from '@app-types/common';

class SemestersRepository extends BaseRepository {
  constructor() {
    super('semesters');
  }

  async findCurrent(): Promise<AnyRecord | null> {
    return await this.findOne({ isCurrent: true });
  }
}

export default new SemestersRepository();
