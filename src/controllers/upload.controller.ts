import uploadService from '@services/common/upload.service';

class UploadController {
  getUploadMiddleware(type = 'temp') {
    return uploadService.getSingleUpload('image', type === 'avatar' ? 'avatars' : type);
  }

  uploadAvatar = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const data = await uploadService.uploadAvatar(req.file, req.user.id, {
        uploadedBy: req.user.id,
        storeData: req.body.storeData,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  uploadGeneralFile = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      const data = await uploadService.uploadGeneralFile(req.file, {
        uploadedBy: req.user.id,
        storeData: req.body.storeData,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteFile = async (req, res, next) => {
    try {
      const data = await uploadService.deleteFile(
        req.body.publicId || req.body.url || req.query.publicId || req.query.url,
      );
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getFileInfo = async (req, res, next) => {
    try {
      const data = await uploadService.getFileInfo(req.query.publicId || req.query.url);
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
