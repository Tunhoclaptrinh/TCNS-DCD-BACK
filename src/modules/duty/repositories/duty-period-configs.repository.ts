import BaseRepository from '@shared/repositories/base.repository';

class DutyPeriodConfigsRepository extends BaseRepository {
  constructor() {
    super('duty_period_configs');
  }

  async findByRange(startDate: Date, endDate: Date) {
    // Find a config that matches this exact range or overlaps
    // For now, we focus on exact range for week-based logic
    return await this.findOne({
      startDate: { $lte: endDate },
      endDate: { $gte: startDate },
    });
  }
}

export default new DutyPeriodConfigsRepository();
