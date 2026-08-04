import multer from 'multer';
import BaseController from '@shared/common/base-controller';
import importExportService from '@shared/import-export/services/import-export.service';

class ImportExportController extends BaseController {
  getUploadMiddleware() {
    return multer({ storage: multer.memoryStorage() }).single('file');
  }

  getFormat(queryValue) {
    return Array.isArray(queryValue) ? String(queryValue[0] || 'xlsx') : String(queryValue || 'xlsx');
  }

  validateData = this.handle(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { entity } = req.params;
    const report = await importExportService.validateImportFile(entity, req.file.buffer, req.file.originalname);
    this.ok(res, report);
  });

  importData = this.handle(async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { entity } = req.params;
    const data = await importExportService.importData(entity, req.file.buffer, req.file.originalname);
    this.ok(res, data);
  });

  exportData = this.handle(async (req, res) => {
    const { entity } = req.params;
    const format = this.getFormat(req.query.format);
    const options = { ...req.query, ...req.parsedQuery };
    const buffer = await importExportService.exportData(entity, format, options);

    const contentType =
      format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const ext = format === 'csv' ? 'csv' : 'xlsx';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${entity}.${ext}"`);
    res.send(buffer);
  });

  downloadTemplate = this.handle(async (req, res) => {
    const { entity } = req.params;
    const format = this.getFormat(req.query.format);
    const columns = req.query.columns ? String(req.query.columns).split(',') : undefined;
    const withMockData = req.query.withMockData !== 'false';
    const buffer = await importExportService.generateTemplate(entity, format, columns, withMockData);

    const ext = format === 'csv' ? 'csv' : 'xlsx';
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${entity}_template.${ext}"`);
    res.send(buffer);
  });
}

export default new ImportExportController();
