import BaseRepository from '@shared/repositories/base.repository';

class DutyShiftsRepository extends BaseRepository {
  constructor() {
    super('duty_shifts');
  }

  async findByDayId(dayId: string | number) {
    return await this.findMany({ dayId });
  }

  async findByDate(date: string) {
    return await this.findMany({ date });
  }
}

export default new DutyShiftsRepository();
