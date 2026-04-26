import BaseRepository from '@shared/repositories/base.repository';

class AuditLogsRepository extends BaseRepository {
  constructor() {
    super('audit_logs');
  }
}

export default new AuditLogsRepository();
