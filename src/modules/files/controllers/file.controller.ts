import type { Request } from 'express';
import fileService from '@modules/files/services/file.service';
import BaseController from '@shared/common/base-controller';

class FileController extends BaseController {
  shouldIncludeData(req: Request) {
    return fileService.toBoolean(req.query.includeData, false);
  }

  getFiles = this.handle(async (req, res) => {
    const data = await fileService.getAccessibleFiles(req.user, req.parsedQuery, this.shouldIncludeData(req));
    this.ok(res, data);
  });

  getFileById = this.handle(async (req, res) => {
    const data = await fileService.getAccessibleFileById(req.params.id, req.user, this.shouldIncludeData(req));
    this.ok(res, data);
  });

  createUrlOnly = this.handle(async (req, res) => {
    const { url, filename } = req.body;
    const data = await fileService.createUrlOnly({
      url,
      filename,
      uploadedBy: req.user?.id,
    });
    this.ok(res, {
      success: true,
      data,
      message: 'Đã tạo bản ghi URL thành công',
    });
  });
}

export default new FileController();
