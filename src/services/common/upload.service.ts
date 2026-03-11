import crypto from 'crypto';
import path from 'path';
import multer from 'multer';
import sharp from 'sharp';
import axios from 'axios';
import FormData from 'form-data';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const FOLDERS = ['avatars', 'general', 'temp'];
const CLOUDINARY_API_BASE = 'https://api.cloudinary.com/v1_1';

const FORMAT_MAP = {
  jpeg: (instance, quality) => instance.jpeg({ quality }),
  png: (instance, quality) => instance.png({ quality }),
  webp: (instance, quality) => instance.webp({ quality }),
};

type ProcessImageOptions = {
  width?: number | null;
  height?: number | null;
  quality?: number;
  format?: keyof typeof FORMAT_MAP;
  fit?: keyof sharp.FitEnum;
};

class UploadService {
  cloudName: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  rootFolder: string;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || null;
    this.apiKey = process.env.CLOUDINARY_API_KEY || null;
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || null;
    this.rootFolder = String(process.env.CLOUDINARY_FOLDER || 'tcns')
      .trim()
      .replace(/^\/+|\/+$/g, '');
  }

  assertConfigured() {
    if (this.cloudName && this.apiKey && this.apiSecret) {
      return;
    }

    throw new ApiError(
      500,
      'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.',
    );
  }

  getMulterConfig() {
    return {
      storage: multer.memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error(`Invalid file type. Allowed: ${[...ALLOWED_IMAGE_TYPES].join(', ')}`), false);
        }
      },
      limits: { fileSize: MAX_FILE_SIZE },
    };
  }

  getSingleUpload(fieldName = 'image', _folder = 'temp') {
    return multer(this.getMulterConfig()).single(fieldName);
  }

  getMultipleUpload(fieldName = 'images', maxCount = 5, _folder = 'temp') {
    return multer(this.getMulterConfig()).array(fieldName, maxCount);
  }

  sanitizePublicIdSegment(value: string) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);
  }

  getFolderPath(folder: string) {
    const normalizedFolder = String(folder || 'temp')
      .trim()
      .replace(/^\/+|\/+$/g, '');

    return [this.rootFolder, normalizedFolder].filter(Boolean).join('/');
  }

  buildPublicId(folder: string, baseName: string) {
    const safeName = this.sanitizePublicIdSegment(baseName) || `file-${Date.now()}`;
    return {
      folder: this.getFolderPath(folder),
      publicId: safeName,
      fullPublicId: [this.getFolderPath(folder), safeName].filter(Boolean).join('/'),
    };
  }

  createSignature(params: Record<string, string | number | boolean>) {
    this.assertConfigured();

    const payload = Object.entries(params)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return crypto.createHash('sha1').update(`${payload}${this.apiSecret}`).digest('hex');
  }

  getUploadUrl(resourceType = 'image') {
    this.assertConfigured();
    return `${CLOUDINARY_API_BASE}/${this.cloudName}/${resourceType}/upload`;
  }

  getDestroyUrl(resourceType = 'image') {
    this.assertConfigured();
    return `${CLOUDINARY_API_BASE}/${this.cloudName}/${resourceType}/destroy`;
  }

  getAdminUrl(pathname: string) {
    this.assertConfigured();
    return `${CLOUDINARY_API_BASE}/${this.cloudName}/${pathname}`;
  }

  async processImageBuffer(file: AnyRecord, options: ProcessImageOptions = {}) {
    if (!file?.buffer) {
      throw ApiError.badRequest('No file data received');
    }

    const { width = null, height = null, quality = 80, format = 'jpeg', fit = 'cover' } = options;
    let instance = sharp(file.buffer, { animated: false });

    if (width || height) {
      instance = instance.resize(width, height, { fit });
    }

    const applyFormat = FORMAT_MAP[format];
    if (applyFormat) {
      instance = applyFormat(instance, quality);
    }

    const { data, info } = await instance.toBuffer({ resolveWithObject: true });

    return {
      buffer: data,
      format: info.format,
      width: info.width,
      height: info.height,
      bytes: info.size,
    };
  }

  async uploadToCloudinary(buffer: Buffer, options: { folder: string; publicId: string; mimeType?: string }) {
    this.assertConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      asset_folder: options.folder,
      overwrite: true,
      public_id: options.publicId,
      public_id_prefix: options.folder,
      timestamp,
    };
    const signature = this.createSignature(params);
    const form = new FormData();

    form.append('file', buffer, {
      filename: `${options.publicId}.jpg`,
      contentType: options.mimeType || 'image/jpeg',
    });
    form.append('api_key', this.apiKey as string);
    form.append('timestamp', String(timestamp));
    form.append('asset_folder', options.folder);
    form.append('public_id', options.publicId);
    form.append('public_id_prefix', options.folder);
    form.append('overwrite', 'true');
    form.append('signature', signature);

    try {
      const response = await axios.post(this.getUploadUrl('image'), form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return response.data;
    } catch (error: any) {
      throw ApiError.badRequest(error.response?.data?.error?.message || error.message || 'Cloudinary upload failed');
    }
  }

  mapCloudinaryAsset(asset: AnyRecord) {
    return {
      url: asset.secure_url,
      secureUrl: asset.secure_url,
      publicId: asset.public_id,
      filename: asset.original_filename || path.basename(String(asset.public_id || '')),
      format: asset.format,
      width: asset.width,
      height: asset.height,
      bytes: asset.bytes,
      createdAt: asset.created_at,
      folder: asset.asset_folder || asset.folder || path.dirname(String(asset.public_id || '')),
      provider: 'cloudinary',
    };
  }

  async uploadAndProcess(file: AnyRecord, folder: string, baseName: string, imageOptions: ProcessImageOptions) {
    const processed = await this.processImageBuffer(file, imageOptions);
    const { folder: folderPath, publicId } = this.buildPublicId(folder, baseName);
    const uploaded = await this.uploadToCloudinary(processed.buffer, {
      folder: folderPath,
      publicId,
      mimeType: `image/${processed.format}`,
    });

    return this.mapCloudinaryAsset(uploaded);
  }

  async uploadAvatar(file: AnyRecord, userId: string | number) {
    return this.uploadAndProcess(file, 'avatars', `user-${userId}-${Date.now()}`, {
      width: 200,
      height: 200,
      quality: 85,
      format: 'jpeg',
      fit: 'cover',
    });
  }

  async uploadGeneralFile(file: AnyRecord) {
    const originalBaseName = path.parse(String(file?.originalname || `file-${Date.now()}`)).name;

    return this.uploadAndProcess(file, 'general', `${originalBaseName}-${Date.now()}`, {
      width: 1200,
      height: 1200,
      fit: 'inside',
      quality: 85,
      format: 'jpeg',
    });
  }

  resolvePublicId(input: string) {
    const raw = String(input || '').trim();

    if (!raw) {
      throw ApiError.badRequest('url or publicId is required');
    }

    if (!/^https?:\/\//i.test(raw)) {
      return raw;
    }

    try {
      const parsed = new URL(raw);
      const uploadIndex = parsed.pathname.indexOf('/upload/');

      if (uploadIndex === -1) {
        throw new Error('Invalid Cloudinary URL');
      }

      const afterUpload = parsed.pathname.slice(uploadIndex + '/upload/'.length);
      const segments = afterUpload.split('/').filter(Boolean);
      const versionIndex = segments.findIndex((segment) => /^v\d+$/.test(segment));
      const pathSegments = versionIndex >= 0 ? segments.slice(versionIndex + 1) : segments;

      if (pathSegments.length === 0) {
        throw new Error('Invalid Cloudinary URL');
      }

      const lastSegment = pathSegments[pathSegments.length - 1];
      pathSegments[pathSegments.length - 1] = lastSegment.replace(/\.[^.]+$/, '');

      return pathSegments.join('/');
    } catch {
      throw ApiError.badRequest('Invalid Cloudinary URL');
    }
  }

  async adminRequest(pathname: string, params: Record<string, any> = {}) {
    this.assertConfigured();

    try {
      const response = await axios.get(this.getAdminUrl(pathname), {
        params,
        auth: {
          username: this.apiKey as string,
          password: this.apiSecret as string,
        },
      });

      return response.data;
    } catch (error: any) {
      throw ApiError.badRequest(error.response?.data?.error?.message || error.message || 'Cloudinary request failed');
    }
  }

  async destroyResource(publicId: string) {
    this.assertConfigured();

    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      invalidate: true,
      public_id: publicId,
      timestamp,
    };
    const signature = this.createSignature(params);
    const body = new URLSearchParams();

    body.set('api_key', this.apiKey as string);
    body.set('timestamp', String(timestamp));
    body.set('public_id', publicId);
    body.set('invalidate', 'true');
    body.set('signature', signature);

    try {
      const response = await axios.post(this.getDestroyUrl('image'), body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error: any) {
      throw ApiError.badRequest(error.response?.data?.error?.message || error.message || 'Cloudinary delete failed');
    }
  }

  async listResourcesByFolder(folder: string) {
    const prefix = `${this.getFolderPath(folder)}/`;
    let nextCursor: string | undefined;
    const resources: AnyRecord[] = [];

    do {
      const response = await this.adminRequest('resources/image/upload', {
        max_results: 500,
        next_cursor: nextCursor,
        prefix,
      });

      resources.push(...(response.resources || []));
      nextCursor = response.next_cursor;
    } while (nextCursor);

    return resources;
  }

  async deleteFile(input: string) {
    const publicId = this.resolvePublicId(input);
    const result = await this.destroyResource(publicId);

    if (result.result === 'not found') {
      throw ApiError.notFound('File not found');
    }

    return { message: 'File deleted successfully', publicId, provider: 'cloudinary' };
  }

  async getFileInfo(input: string) {
    const publicId = this.resolvePublicId(input);
    const encodedPublicId = publicId
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
    const resource = await this.adminRequest(`resources/image/upload/${encodedPublicId}`);

    return this.mapCloudinaryAsset(resource);
  }

  async cleanupOldFiles(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const folder of FOLDERS) {
      const resources = await this.listResourcesByFolder(folder);
      const oldResources = resources.filter((item) => new Date(String(item.created_at || 0)).getTime() < cutoff);

      for (const item of oldResources) {
        const result = await this.destroyResource(item.public_id);
        if (result.result === 'ok') {
          deletedCount++;
        }
      }
    }

    return { message: `Deleted ${deletedCount} old files`, deletedCount, provider: 'cloudinary' };
  }

  async getStorageStats() {
    const stats: AnyRecord = { totalSize: 0, totalFiles: 0, byFolder: {}, provider: 'cloudinary' };

    for (const folder of FOLDERS) {
      const resources = await this.listResourcesByFolder(folder);
      const totalSize = resources.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);

      stats.byFolder[folder] = {
        files: resources.length,
        size: totalSize,
        sizeFormatted: this.formatBytes(totalSize),
      };

      stats.totalFiles += resources.length;
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
