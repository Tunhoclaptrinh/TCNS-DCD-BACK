import BaseRepository from '@shared/repositories/base.repository';

class DutyLeaveRequestsRepository extends BaseRepository {
  constructor() {
    super('duty_leave_requests');
  }
}

export default new DutyLeaveRequestsRepository();
