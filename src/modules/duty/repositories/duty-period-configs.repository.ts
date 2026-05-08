import BaseRepository from '@shared/repositories/base.repository';

class DutyPeriodConfigsRepository extends BaseRepository {
  constructor() {
    super('duty_period_configs');
  }

  async findByRange(startDate: Date, endDate: Date) {
    // Find a config that overlaps with this range.
    // This ensures that if a month is configured, its weeks are also considered initialized.
    return await this.findOne({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
  }
}

export default new DutyPeriodConfigsRepository();
