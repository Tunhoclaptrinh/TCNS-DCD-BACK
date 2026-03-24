import uploadService from '@services/file/upload.service';
import type { UploadCategory } from '@app-types/upload';

class UploadController {
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

  uploadAvatar = async (req, res, next) => {
    try {
      const file = this.getUploadedFile(req);
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const data = await uploadService.uploadAvatar(file, req.user.id, this.buildUploadOptions(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  uploadGeneralFile = async (req, res, next) => {
    try {
      const file = this.getUploadedFile(req);
      if (!file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const data = await uploadService.uploadGeneralFile(file, this.buildUploadOptions(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteFile = async (req, res, next) => {
    try {
      const data = await uploadService.deleteFile(this.getFileInput(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getFileInfo = async (req, res, next) => {
    try {
      const data = await uploadService.getFileInfo(this.getFileInput(req));
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getStorageStats = async (req, res, next) => {
    try {
      const data = await uploadService.getStorageStats();
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  cleanupOldFiles = async (req, res, next) => {
    try {
      const days = parseInt(req.body.days || req.query.days) || 30;
      const data = await uploadService.cleanupOldFiles(days);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new UploadController();
