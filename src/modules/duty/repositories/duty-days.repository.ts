import BaseRepository from '@shared/repositories/base.repository';

class DutyDaysRepository extends BaseRepository {
  constructor() {
    super('duty_days');
  }

  async findByDate(date: string) {
    return await this.findOne({ date });
  }
}

export default new DutyDaysRepository();
