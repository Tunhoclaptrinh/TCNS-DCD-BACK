import BaseService from '@shared/common/base-service';
import dutyLogsRepository from '@modules/duty/repositories/duty-logs.repository';

class DutyLogService extends BaseService {
  constructor() {
    super('duty_logs', dutyLogsRepository);
  }
}

export default new DutyLogService();
