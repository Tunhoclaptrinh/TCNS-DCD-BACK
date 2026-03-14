import type { Request } from 'express';
import fileService from '@services/file/file.service';

class FileController {
  shouldIncludeData(req: Request) {
    return fileService.toBoolean(req.query.includeData, false);
  }

  getFiles = async (req, res, next) => {
    try {
      const data = await fileService.getAccessibleFiles(req.user, req.parsedQuery, this.shouldIncludeData(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getFileById = async (req, res, next) => {
    try {
      const data = await fileService.getAccessibleFileById(req.params.id, req.user, this.shouldIncludeData(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new FileController();
