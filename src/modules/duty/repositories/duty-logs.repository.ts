import BaseRepository from '@shared/repositories/base.repository';

class DutyLogsRepository extends BaseRepository {
  constructor() {
    super('duty_logs');
  }
}

export default new DutyLogsRepository();
