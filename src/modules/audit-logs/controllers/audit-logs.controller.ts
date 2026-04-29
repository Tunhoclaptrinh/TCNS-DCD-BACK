import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import BaseController from '@shared/common/base-controller';

class AuditLogsController extends BaseController {
  constructor() {
    super(auditLogsService);
  }

  getLogs = this.handle(async (req, res) => {
    // Mac dinh tu dong populate user de hien thi ten nguoi thuc hien
    const query = {
      ...req.parsedQuery,
      embed: (req.query.embed || 'user') as string,
    };

    const result = await auditLogsService.getPage(query);
    this.ok(res, result);
  });
}

export default new AuditLogsController();
