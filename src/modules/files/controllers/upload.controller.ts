import uploadService from '@modules/files/services/upload.service';
import type { UploadCategory } from '@app-types/upload';
import BaseController from '@shared/common/base-controller';

class UploadController extends BaseController {
  getUploadMiddleware(type: UploadCategory = 'temp') {
    if (type === 'avatar') {
      return uploadService.getFlexibleSingleUpload(['image', 'avatar'], 'avatar');
    }

    if (type === 'general') {
      return uploadService.getFlexibleSingleUpload(['file', 'image'], 'general');
    }

    return uploadService.getFlexibleSingleUpload(['file', 'image'], type);
  }

  buildUploadOptions(req) {
    return {
      uploadedBy: req.user.id,
      storeData: req.body.storeData,
    };
  }

  getFileInput(req) {
    return req.body.publicId || req.body.url || req.query.publicId || req.query.url;
  }

  getUploadedFile(req) {
    if (req.file) {
      return req.file;
    }

    const files = req.files || {};
    return files.file?.[0] || files.image?.[0] || files.avatar?.[0] || null;
  }

  uploadAvatar = this.handle(async (req, res) => {
    const file = this.getUploadedFile(req);
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const data = await uploadService.uploadAvatar(file, req.user.id, this.buildUploadOptions(req));
    this.ok(res, data);
  });

  uploadGeneralFile = this.handle(async (req, res) => {
    const file = this.getUploadedFile(req);
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    const data = await uploadService.uploadGeneralFile(file, this.buildUploadOptions(req));
    this.ok(res, data);
  });

  deleteFile = this.handle(async (req, res) => {
    const data = await uploadService.deleteFile(this.getFileInput(req));
    this.ok(res, data);
  });

  getFileInfo = this.handle(async (req, res) => {
    const data = await uploadService.getFileInfo(this.getFileInput(req));
    this.ok(res, data);
  });

  getStorageStats = this.handle(async (_req, res) => {
    const data = await uploadService.getStorageStats();
    this.ok(res, data);
  });

  cleanupOldFiles = this.handle(async (req, res) => {
    const days = parseInt(req.body.days || req.query.days) || 30;
    const data = await uploadService.cleanupOldFiles(days);
    this.ok(res, data);
  });
}

export default new UploadController();
