import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';

class UploadService {
  constructor() {
    this.uploadDir = path.join(__dirname, '../database/uploads');
    this.maxFileSize = 5 * 1024 * 1024;
    this.allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    this.initUploadDirs();
  }

  initUploadDirs() {
    const dirs = [
      this.uploadDir,
      path.join(this.uploadDir, 'avatars'),
      path.join(this.uploadDir, 'general'),
      path.join(this.uploadDir, 'temp'),
    ];

    dirs.forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
      }
    });
  }

  getMulterStorage(folder = 'temp') {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(this.uploadDir, folder);
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      },
    });
  }

  fileFilter(req, file, cb) {
    if (this.allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${this.allowedImageTypes.join(', ')}`), false);
    }
  }

  getSingleUpload(fieldName = 'image', folder = 'temp') {
    return multer({
      storage: this.getMulterStorage(folder),
      fileFilter: this.fileFilter.bind(this),
      limits: {
        fileSize: this.maxFileSize,
      },
    }).single(fieldName);
  }

  getMultipleUpload(fieldName = 'images', maxCount = 5, folder = 'temp') {
    return multer({
      storage: this.getMulterStorage(folder),
      fileFilter: this.fileFilter.bind(this),
      limits: {
        fileSize: this.maxFileSize,
      },
    }).array(fieldName, maxCount);
  }

  async processImage(filePath, options = {}) {
    try {
      const { width = null, height = null, quality = 80, format = 'jpeg', fit = 'cover' } = options;

      const processedPath = filePath.replace(path.extname(filePath), `-processed.${format}`);

      let sharpInstance = sharp(filePath);

      if (width || height) {
        sharpInstance = sharpInstance.resize(width, height, { fit });
      }

      if (format === 'jpeg') {
        sharpInstance = sharpInstance.jpeg({ quality });
      } else if (format === 'png') {
        sharpInstance = sharpInstance.png({ quality });
      } else if (format === 'webp') {
        sharpInstance = sharpInstance.webp({ quality });
      }

      await sharpInstance.toFile(processedPath);

      fs.unlinkSync(filePath);

      return {
        success: true,
        filePath: processedPath,
        filename: path.basename(processedPath),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async uploadAvatar(file, userId) {
    try {
      const newPath = path.join(this.uploadDir, 'avatars', `user-${userId}-${Date.now()}.jpeg`);

      const result = await this.processImage(file.path, {
        width: 200,
        height: 200,
        quality: 85,
        format: 'jpeg',
        fit: 'cover',
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      fs.renameSync(result.filePath, newPath);

      const url = `/uploads/avatars/${path.basename(newPath)}`;

      return {
        success: true,
        url,
        filename: path.basename(newPath),
        path: newPath,
      };
    } catch (error) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw error;
    }
  }

  async uploadGeneralFile(file) {
    try {
      const generalDir = path.join(this.uploadDir, 'general');
      if (!fs.existsSync(generalDir)) {
        fs.mkdirSync(generalDir, { recursive: true });
      }
      const newPath = path.join(generalDir, `file-${Date.now()}.jpeg`);

      const result = await this.processImage(file.path, {
        width: 1200,
        height: 1200,
        fit: 'inside',
        quality: 85,
        format: 'jpeg',
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      fs.renameSync(result.filePath, newPath);

      return {
        success: true,
        url: `/uploads/general/${path.basename(newPath)}`,
      };
    } catch (error) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw error;
    }
  }

  async deleteFile(url) {
    try {
      const filename = url.split('/').pop();
      const folder = url.split('/').slice(-2, -1)[0];
      const filePath = path.join(this.uploadDir, folder, filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return {
          success: true,
          message: 'File deleted successfully',
        };
      }

      return {
        success: false,
        message: 'File not found',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async getFileInfo(url) {
    try {
      const filename = url.split('/').pop();
      const folder = url.split('/').slice(-2, -1)[0];
      const filePath = path.join(this.uploadDir, folder, filename);

      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: 'File not found',
        };
      }

      const stats = fs.statSync(filePath);

      return {
        success: true,
        data: {
          filename,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          path: filePath,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async cleanupOldFiles(days = 30) {
    const folders = ['avatars', 'general', 'temp'];
    const now = Date.now();
    const maxAge = days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const folder of folders) {
      const folderPath = path.join(this.uploadDir, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);

        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const stats = fs.statSync(filePath);
          const fileAge = now - stats.mtimeMs;

          if (fileAge > maxAge) {
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        }
      }
    }

    return {
      success: true,
      message: `Deleted ${deletedCount} old files`,
      deletedCount,
    };
  }

  async getStorageStats() {
    const folders = ['avatars', 'general', 'temp'];
    const stats = {
      totalSize: 0,
      totalFiles: 0,
      byFolder: {},
    };

    for (const folder of folders) {
      const folderPath = path.join(this.uploadDir, folder);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath);

        let folderSize = 0;
        for (const file of files) {
          const filePath = path.join(folderPath, file);
          const fileStats = fs.statSync(filePath);
          folderSize += fileStats.size;
        }

        stats.byFolder[folder] = {
          files: files.length,
          size: folderSize,
          sizeFormatted: this.formatBytes(folderSize),
        };

        stats.totalFiles += files.length;
        stats.totalSize += folderSize;
      }
    }

    stats.totalSizeFormatted = this.formatBytes(stats.totalSize);

    return {
      success: true,
      data: stats,
    };
  }

  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}

export default new UploadService();
