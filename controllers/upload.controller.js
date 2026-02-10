const uploadService = require('../services/upload.service');
const db = require('../config/database');

class UploadController {
  /**
   * Get upload middleware based on type
   */
  getUploadMiddleware(type) {
    return (req, res, next) => {
      const middleware = uploadService.getSingleUpload('image', type);
      middleware(req, res, (err) => {
        if (err) {
          console.error('Upload Metadata Error:', err);
          return res.status(400).json({
            success: false,
            message: err.message
          });
        }
        next();
      });
    };
  }

  /**
   * Upload avatar
   * POST /api/upload/avatar
   */
  uploadAvatar = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      const result = await uploadService.uploadAvatar(req.file, req.user.id);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.error
        });
      }

      // Update user avatar in database
      constupdatedUser = await db.update('users', req.user.id, {
        avatar: result.url,
        updatedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Avatar uploaded successfully',
        data: {
          url: result.url,
          filename: result.filename,
          user: {
            id: updatedUser.id,
            name: updatedUser.name,
            avatar: updatedUser.avatar
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Upload general file
   */
  uploadGeneralFile = async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'Please upload a file' });
      }

      const result = await uploadService.uploadGeneralFile(req.file);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete file
   * DELETE /api/upload/file?url=/uploads/avatars/file.jpg
   */
  deleteFile = async (req, res, next) => {
    try {
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL parameter is required'
        });
      }

      const result = await uploadService.deleteFile(url);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get file info
   * GET /api/upload/file/info?url=/uploads/avatars/file.jpg
   */
  getFileInfo = async (req, res, next) => {
    try {
      const { url } = req.query;

      if (!url) {
        return res.status(400).json({
          success: false,
          message: 'URL parameter is required'
        });
      }

      const result = await uploadService.getFileInfo(url);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          message: result.message
        });
      }

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get storage statistics
   * GET /api/upload/stats
   */
  getStorageStats = async (req, res, next) => {
    try {
      const result = await uploadService.getStorageStats();

      res.json({
        success: true,
        data: result.data
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Cleanup old files
   * POST /api/upload/cleanup
   */
  cleanupOldFiles = async (req, res, next) => {
    try {
      const { days = 30 } = req.body;

      const result = await uploadService.cleanupOldFiles(days);

      res.json({
        success: true,
        message: result.message,
        data: {
          deletedCount: result.deletedCount
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new UploadController();