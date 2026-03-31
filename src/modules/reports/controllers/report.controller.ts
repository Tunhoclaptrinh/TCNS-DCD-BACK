import reportService from '@modules/reports/services/report.service';
import BaseController from '@shared/common/base-controller';

class ReportController extends BaseController {
  getFormat(queryValue) {
    return Array.isArray(queryValue) ? String(queryValue[0] || 'xlsx') : String(queryValue || 'xlsx');
  }

  getOverview = this.handle(async (_req, res) => {
    const data = await reportService.getOverview();
    this.ok(res, data);
  });

  exportOverview = this.handle(async (req, res) => {
    const format = this.getFormat(req.query.format);
    const output = await reportService.exportOverview(format);
    res.setHeader('Content-Type', output.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);
    res.send(output.buffer);
  });
}

export default new ReportController();
