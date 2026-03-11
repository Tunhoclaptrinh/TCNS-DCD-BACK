import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FOLDERS = ['avatars', 'general', 'temp'];

const FORMAT_MAP = {
  jpeg: (instance, quality) => instance.jpeg({ quality }),
  png: (instance, quality) => instance.png({ quality }),
  webp: (instance, quality) => instance.webp({ quality }),
};

type ProcessImageOptions = {
  width?: number | null;
  height?: number | null;
  quality?: number;
  format?: keyof typeof FORMAT_MAP | 'gif';
  fit?: keyof sharp.FitEnum;
};

function resolveFromUrl(uploadDir: string, url: string) {
  const parts = url.split('/');
  const filename = parts.pop();
  const folder = parts.pop();
  return path.join(uploadDir, folder || '', filename || '');
}

class UploadService {
  uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.resolve(process.cwd(), 'src/database/uploads');
    this.ensureDir(this.uploadDir);
    FOLDERS.forEach((f) => this.ensureDir(path.join(this.uploadDir, f)));
  }

  ensureDir(dir: string) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  getMulterConfig(folder = 'temp') {
    return {
      storage: multer.diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = path.join(this.uploadDir, folder);
          this.ensureDir(uploadPath);
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file type. Allowed: ${[...ALLOWED_IMAGE_TYPES].join(', ')}`), false);
        }
      },
      limits: { fileSize: MAX_FILE_SIZE },
    };
  }

  getSingleUpload(fieldName = 'image', folder = 'temp') {
    return multer(this.getMulterConfig(folder)).single(fieldName);
  }

  getMultipleUpload(fieldName = 'images', maxCount = 5, folder = 'temp') {
    return multer(this.getMulterConfig(folder)).array(fieldName, maxCount);
  }

  async processImage(filePath: string, options: ProcessImageOptions = {}) {
    const { width = null, height = null, quality = 80, format = 'jpeg', fit = 'cover' } = options;
    const processedPath = filePath.replace(path.extname(filePath), `-processed.${format}`);

    let instance = sharp(filePath);

    if (width || height) {
      instance = instance.resize(width, height, { fit });
    }

    const applyFormat = FORMAT_MAP[format];
    if (applyFormat) {
      instance = applyFormat(instance, quality);
    }

    await instance.toFile(processedPath);
    fs.unlinkSync(filePath);

    return { filePath: processedPath, filename: path.basename(processedPath) };
  }

  async uploadAndProcess(file: AnyRecord, folder: string, filename: string, imageOptions: ProcessImageOptions) {
    try {
      const result = await this.processImage(file.path, imageOptions);

      const newPath = path.join(this.uploadDir, folder, filename);
      fs.renameSync(result.filePath, newPath);

      return {
        url: `/uploads/${folder}/${path.basename(newPath)}`,
        filename: path.basename(newPath),
        path: newPath,
      };
    } catch (error) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw error;
    }
  }

  async uploadAvatar(file: AnyRecord, userId: string | number) {
    return this.uploadAndProcess(file, 'avatars', `user-${userId}-${Date.now()}.jpeg`, {
      width: 200,
      height: 200,
      quality: 85,
      format: 'jpeg',
      fit: 'cover',
    });
  }

  async uploadGeneralFile(file: AnyRecord) {
    return this.uploadAndProcess(file, 'general', `file-${Date.now()}.jpeg`, {
      width: 1200,
      height: 1200,
      fit: 'inside',
      quality: 85,
      format: 'jpeg',
    });
  }

  async deleteFile(url: string) {
    const filePath = resolveFromUrl(this.uploadDir, url);

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound('File not found');
    }

    fs.unlinkSync(filePath);
    return { message: 'File deleted successfully' };
  }

  async getFileInfo(url: string) {
    const filePath = resolveFromUrl(this.uploadDir, url);

    if (!fs.existsSync(filePath)) {
      throw ApiError.notFound('File not found');
    }

    const stats = fs.statSync(filePath);
    return {
      filename: path.basename(filePath),
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      path: filePath,
    };
  }

  getFolderStats(folderPath: string) {
    if (!fs.existsSync(folderPath)) return { files: [], totalSize: 0 };

    const files = fs.readdirSync(folderPath);
    let totalSize = 0;

    const fileEntries = files.map((file) => {
      const stats = fs.statSync(path.join(folderPath, file));
      totalSize += stats.size;
      return { file, mtimeMs: stats.mtimeMs, size: stats.size };
    });

    return { files: fileEntries, totalSize };
  }

  async cleanupOldFiles(days = 30) {
    const maxAge = days * 24 * 60 * 60 * 1000;
    const now = Date.now();
    let deletedCount = 0;

    for (const folder of FOLDERS) {
      const { files } = this.getFolderStats(path.join(this.uploadDir, folder));
      for (const { file, mtimeMs } of files) {
        if (now - mtimeMs > maxAge) {
          fs.unlinkSync(path.join(this.uploadDir, folder, file));
          deletedCount++;
        }
      }
    }

    return { message: `Deleted ${deletedCount} old files`, deletedCount };
  }

  async getStorageStats() {
    const stats: AnyRecord = { totalSize: 0, totalFiles: 0, byFolder: {} };

    for (const folder of FOLDERS) {
      const { files, totalSize } = this.getFolderStats(path.join(this.uploadDir, folder));

      stats.byFolder[folder] = {
        files: files.length,
        size: totalSize,
        sizeFormatted: this.formatBytes(totalSize),
      };

      stats.totalFiles += files.length;
      stats.totalSize += totalSize;
    }

    stats.totalSizeFormatted = this.formatBytes(stats.totalSize);
    return stats;
  }

  formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(Math.max(0, decimals)))} ${sizes[i]}`;
  }
}

export default new UploadService();
