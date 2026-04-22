import BaseRepository from '@shared/repositories/base.repository';

class DutyShiftsRepository extends BaseRepository {
  constructor() {
    super('duty_shifts');
  }

  async findByTemplateId(templateId: string | number | null) {
    return await this.findMany({ templateId });
  }
}

export default new DutyShiftsRepository();
