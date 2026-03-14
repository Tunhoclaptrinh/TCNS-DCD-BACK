import reportService from '@services/report/report.service';

class ReportController {
  getOverview = async (req, res, next) => {
    try {
      const data = await reportService.getOverview();
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  exportOverview = async (req, res, next) => {
    try {
      const format = req.query.format || 'xlsx';
      const output = await reportService.exportOverview(format);
      res.setHeader('Content-Type', output.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);
      res.send(output.buffer);
    } catch (error) {
      next(error);
    }
  };
}

export default new ReportController();
