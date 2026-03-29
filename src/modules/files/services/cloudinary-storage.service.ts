import crypto from 'crypto';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';
import type { CloudinaryAsset, StorageResourceType, UploadFolder } from '@app-types/upload';

const CLOUDINARY_API_BASE = 'https://api.cloudinary.com/v1_1';
const STORAGE_RESOURCE_TYPES: StorageResourceType[] = ['image', 'raw'];

type UploadToCloudinaryOptions = {
  buffer: Buffer;
  folder: UploadFolder;
  baseName: string;
  mimeType: string;
  filename?: string | null;
  resourceType?: StorageResourceType;
};

class CloudinaryStorageService {
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

  detectResourceType(mimeType?: string | null): StorageResourceType {
    return String(mimeType || '')
      .toLowerCase()
      .startsWith('image/')
      ? 'image'
      : 'raw';
  }

  sanitizePublicIdSegment(value: string) {
    return String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 120);
  }

  getFolderPath(folder: UploadFolder) {
    return [this.rootFolder, folder].filter(Boolean).join('/');
  }

  buildPublicId(folder: UploadFolder, baseName: string) {
    const safeName = this.sanitizePublicIdSegment(baseName) || `file-${Date.now()}`;
    const folderPath = this.getFolderPath(folder);

    return {
      folder: folderPath,
      publicId: safeName,
      fullPublicId: [folderPath, safeName].filter(Boolean).join('/'),
    };
  }

  extractCloudinaryErrorMessage(error: any, fallbackMessage: string) {
    return error?.response?.data?.error?.message || error?.message || fallbackMessage;
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

  getUploadUrl(resourceType: StorageResourceType) {
    this.assertConfigured();
    return `${CLOUDINARY_API_BASE}/${this.cloudName}/${resourceType}/upload`;
  }

  getDestroyUrl(resourceType: StorageResourceType) {
    this.assertConfigured();
    return `${CLOUDINARY_API_BASE}/${this.cloudName}/${resourceType}/destroy`;
  }

  getAdminUrl(pathname: string) {
    this.assertConfigured();
    return `${CLOUDINARY_API_BASE}/${this.cloudName}/${pathname}`;
  }

  buildUploadFilename(publicId: string, sourceFilename?: string | null, mimeType?: string | null) {
    const sourceExt = path
      .extname(String(sourceFilename || ''))
      .replace('.', '')
      .toLowerCase();
    const mimeExt = String(mimeType || '')
      .split('/')
      .pop()
      ?.replace(/[^a-z0-9]+/gi, '')
      .toLowerCase();
    const extension = sourceExt || mimeExt || 'bin';

    return `${publicId}.${extension}`;
  }

  mapCloudinaryAsset(asset: AnyRecord, resourceType: StorageResourceType): CloudinaryAsset {
    return {
      url: asset.secure_url || asset.url,
      secureUrl: asset.secure_url || asset.url,
      publicId: asset.public_id,
      filename: asset.original_filename || path.basename(String(asset.public_id || '')),
      format: asset.format || null,
      bytes: Number(asset.bytes) || null,
      createdAt: asset.created_at || null,
      folder: asset.asset_folder || asset.folder || path.dirname(String(asset.public_id || '')),
      provider: 'cloudinary',
      resourceType,
    };
  }

  async upload(options: UploadToCloudinaryOptions) {
    this.assertConfigured();

    const resourceType = options.resourceType || this.detectResourceType(options.mimeType);
    const { folder, publicId } = this.buildPublicId(options.folder, options.baseName);
    const timestamp = Math.floor(Date.now() / 1000);
    const params = {
      asset_folder: folder,
      overwrite: true,
      public_id: publicId,
      public_id_prefix: folder,
      timestamp,
    };
    const signature = this.createSignature(params);
    const form = new FormData();

    form.append('file', options.buffer, {
      filename: this.buildUploadFilename(publicId, options.filename, options.mimeType),
      contentType: options.mimeType || 'application/octet-stream',
    });
    form.append('api_key', this.apiKey as string);
    form.append('timestamp', String(timestamp));
    form.append('asset_folder', folder);
    form.append('public_id', publicId);
    form.append('public_id_prefix', folder);
    form.append('overwrite', 'true');
    form.append('signature', signature);

    try {
      const response = await axios.post(this.getUploadUrl(resourceType), form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      });

      return this.mapCloudinaryAsset(response.data, resourceType);
    } catch (error: any) {
      throw ApiError.badRequest(this.extractCloudinaryErrorMessage(error, 'Cloudinary upload failed'));
    }
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
      throw ApiError.badRequest(this.extractCloudinaryErrorMessage(error, 'Cloudinary request failed'));
    }
  }

  async destroyResource(publicId: string, resourceType: StorageResourceType) {
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
      const response = await axios.post(this.getDestroyUrl(resourceType), body.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      return response.data;
    } catch (error: any) {
      throw ApiError.badRequest(this.extractCloudinaryErrorMessage(error, 'Cloudinary delete failed'));
    }
  }

  buildResourceTypeCandidates(preferred?: StorageResourceType | null) {
    return [preferred, ...STORAGE_RESOURCE_TYPES].filter(
      (resourceType, index, items): resourceType is StorageResourceType =>
        Boolean(resourceType) && items.indexOf(resourceType) === index,
    );
  }

  encodePublicId(publicId: string) {
    return publicId
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  isNotFoundError(error: any) {
    const message = String(error?.response?.data?.error?.message || error?.message || '').toLowerCase();
    return message.includes('not found');
  }

  // Thử lần lượt theo resource type để không buộc caller phải biết file đang nằm ở image hay raw.
  async destroy(publicId: string, preferredResourceType?: StorageResourceType | null) {
    for (const resourceType of this.buildResourceTypeCandidates(preferredResourceType)) {
      const result = await this.destroyResource(publicId, resourceType);

      if (result.result === 'ok') {
        return { ...result, resourceType };
      }
    }

    throw ApiError.notFound('File not found');
  }

  async getFileInfo(publicId: string, preferredResourceType?: StorageResourceType | null) {
    const encodedPublicId = this.encodePublicId(publicId);

    for (const resourceType of this.buildResourceTypeCandidates(preferredResourceType)) {
      try {
        const resource = await this.adminRequest(`resources/${resourceType}/upload/${encodedPublicId}`);
        return this.mapCloudinaryAsset(resource, resourceType);
      } catch (error) {
        if (this.isNotFoundError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw ApiError.notFound('File not found');
  }

  async listResourcesByFolder(folder: UploadFolder, resourceType: StorageResourceType) {
    const prefix = `${this.getFolderPath(folder)}/`;
    let nextCursor: string | undefined;
    const resources: CloudinaryAsset[] = [];

    do {
      const response = await this.adminRequest(`resources/${resourceType}/upload`, {
        max_results: 500,
        next_cursor: nextCursor,
        prefix,
      });

      resources.push(
        ...(response.resources || []).map((item: AnyRecord) => this.mapCloudinaryAsset(item, resourceType)),
      );
      nextCursor = response.next_cursor;
    } while (nextCursor);

    return resources;
  }

  async listAllResourcesByFolder(folder: UploadFolder) {
    const resources = await Promise.all(
      STORAGE_RESOURCE_TYPES.map((resourceType) => this.listResourcesByFolder(folder, resourceType)),
    );
    const merged = resources.flat();
    const unique = new Map<string, CloudinaryAsset>();

    for (const item of merged) {
      unique.set(item.publicId, item);
    }

    return [...unique.values()];
  }

  formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(Math.max(0, decimals)))} ${sizes[i]}`;
  }
}

export default new CloudinaryStorageService();
