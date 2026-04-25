import BaseRepository from '@shared/repositories/base.repository';

class DutyKipsRepository extends BaseRepository {
  constructor() {
    super('duty_kips');
  }

  async findByShiftId(shiftId: string | number) {
    return await this.findMany({ shiftId });
  }

  async deleteByShiftId(shiftId: string | number) {
    return await this.deleteMany({ shiftId });
  }

  async findByDate(date: string) {
    return await this.findMany({ date });
  }
}

export default new DutyKipsRepository();
