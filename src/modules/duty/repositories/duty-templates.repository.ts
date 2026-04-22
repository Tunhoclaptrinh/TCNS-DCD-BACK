import BaseRepository from '@shared/repositories/base.repository';

class DutyTemplatesRepository extends BaseRepository {
  constructor() {
    super('duty_templates');
  }

  async findDefault() {
    return await this.findOne({ isDefault: true });
  }
}

export default new DutyTemplatesRepository();
