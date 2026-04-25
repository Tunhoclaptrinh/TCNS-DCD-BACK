import BaseRepository from '@shared/repositories/base.repository';

class DutyTemplateKipsRepository extends BaseRepository {
  constructor() {
    super('duty_template_kips');
  }

  async findByTemplateShiftId(templateShiftId: string | number) {
    return await this.findMany({ templateShiftId });
  }

  async deleteByTemplateShiftId(templateShiftId: string | number) {
    return await this.deleteMany({ templateShiftId });
  }
}

export default new DutyTemplateKipsRepository();
