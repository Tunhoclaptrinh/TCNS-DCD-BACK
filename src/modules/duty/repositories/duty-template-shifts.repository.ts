import BaseRepository from '@shared/repositories/base.repository';

class DutyTemplateShiftsRepository extends BaseRepository {
  constructor() {
    super('duty_template_shifts');
  }

  async findByTemplateId(templateId: string | number) {
    return await this.findMany({ templateId });
  }
}

export default new DutyTemplateShiftsRepository();
