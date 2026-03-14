import fileService from '@services/common/file.service';

class FileController {
  getFiles = async (req, res, next) => {
    try {
      const includeData = fileService.toBoolean(req.query.includeData, false);
      const data = await fileService.getAccessibleFiles(req.user, req.parsedQuery, includeData);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getFileById = async (req, res, next) => {
    try {
      const includeData = fileService.toBoolean(req.query.includeData, false);
      const data = await fileService.getAccessibleFileById(req.params.id, req.user, includeData);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new FileController();
