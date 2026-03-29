import multer from 'multer';
import importExportService from '@shared/import-export/services/import-export.service';

class ImportExportController {
  getUploadMiddleware() {
    return multer({ storage: multer.memoryStorage() }).single('file');
  }

  importData = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }

      const { entity } = req.params;
      const data = await importExportService.importData(entity, req.file.buffer, req.file.originalname);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  exportData = async (req, res, next) => {
    try {
      const { entity } = req.params;
      const format = req.query.format || 'xlsx';
      const buffer = await importExportService.exportData(entity, format, req.query);

      const contentType =
        format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const ext = format === 'csv' ? 'csv' : 'xlsx';

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${entity}.${ext}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  downloadTemplate = async (req, res, next) => {
    try {
      const { entity } = req.params;
      const format = req.query.format || 'xlsx';
      const buffer = importExportService.generateTemplate(entity, format);

      const ext = format === 'csv' ? 'csv' : 'xlsx';
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${entity}_template.${ext}"`);
      res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}

export default new ImportExportController();
