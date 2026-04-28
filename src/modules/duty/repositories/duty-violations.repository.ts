import BaseRepository from '@shared/repositories/base.repository';

class DutyViolationsRepository extends BaseRepository {
  constructor() {
    super('duty_violations');
  }
}

export default new DutyViolationsRepository();
