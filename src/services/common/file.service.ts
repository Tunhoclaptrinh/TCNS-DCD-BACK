import path from 'path';
import db from '@config/database';
import ApiError from '@utils/api-error';
import BaseService from '@utils/base-service';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { QueryOptions } from '@app-types/database';

type SaveFileRecordOptions = {
  idFile: string;
  urlFile: string;
  uploadedBy?: Identifier | null;
  mimeType?: string | null;
  filename?: string | null;
  bytes?: number | null;
  provider?: string | null;
  dataBuffer?: Buffer | null;
  storeData?: unknown;
};

function normalizeNumericId(value: Identifier | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

class FileService extends BaseService {
  constructor() {
    super('files');
  }

  toBoolean(value: unknown, defaultValue = true) {
    if (value === undefined || value === null || value === '') {
      return defaultValue;
    }

    const normalized = String(value).trim().toLowerCase();
    if (['false', '0', 'no', 'off'].includes(normalized)) {
      return false;
    }
    if (['true', '1', 'yes', 'on'].includes(normalized)) {
      return true;
    }
    return defaultValue;
  }

  detectFileType(mimeType?: string | null, filename?: string | null) {
    const normalizedMime = String(mimeType || '').toLowerCase();
    const extension = path.extname(String(filename || '')).toLowerCase();

    if (normalizedMime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(extension)) {
      return 'image';
    }

    if (normalizedMime === 'application/pdf' || extension === '.pdf') {
      return 'pdf';
    }

    return 'file';
  }

  buildBase64Data(buffer?: Buffer | null, mimeType = 'application/octet-stream') {
    if (!buffer?.length) {
      return null;
    }

    return `data:${mimeType};base64,${buffer.toString('base64')}`;
  }

  sanitizeRecord(item: AnyRecord | null | undefined, includeData = false) {
    if (!item) {
      return item;
    }

    const sanitized = { ...item };
    sanitized.hasData = Boolean(sanitized.data);

    if (!includeData) {
      delete sanitized.data;
    }

    return sanitized;
  }

  async saveFileRecord(options: SaveFileRecordOptions) {
    const mimeType = String(options.mimeType || 'application/octet-stream');
    const filename = String(options.filename || options.idFile || '');
    const payload: AnyRecord = {
      idFile: options.idFile,
      urlFile: options.urlFile,
      uploadedBy: normalizeNumericId(options.uploadedBy),
      fileType: this.detectFileType(mimeType, filename),
      mimeType,
      provider: options.provider || 'cloudinary',
      filename,
      extension: path.extname(filename).replace('.', '').toLowerCase() || null,
      bytes: options.bytes ?? null,
      data: this.toBoolean(options.storeData, true) ? this.buildBase64Data(options.dataBuffer, mimeType) : null,
    };

    const existing = await db.findOne(this.collection, { idFile: payload.idFile });

    if (existing) {
      const updated = await db.update(this.collection, existing.id, {
        ...payload,
        updatedAt: new Date().toISOString(),
      });

      return updated;
    }

    const created = await this.create(payload);
    if (!created.success || !created.data) {
      throw ApiError.badRequest(created.message || 'Unable to save file metadata');
    }

    return created.data;
  }

  async deleteByIdFile(idFile: string) {
    const items = await db.findMany(this.collection, { idFile });

    for (const item of items) {
      await db.delete(this.collection, item.id);
    }

    return items.length;
  }

  async getAccessibleFiles(user: AnyRecord, options: QueryOptions = {}, includeData = false) {
    const canReadAll = ['admin', 'staff', 'researcher'].includes(String(user?.role || ''));
    const uploadedBy = normalizeNumericId(user?.id);
    const filter: AnyRecord = { ...(options.filter || {}) };

    if (!canReadAll && uploadedBy !== null) {
      filter.uploadedBy = uploadedBy;
    }

    const result = await db.findAllAdvanced(this.collection, {
      ...options,
      filter,
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
    });

    return {
      success: true,
      data: result.data.map((item) => this.sanitizeRecord(item, includeData)),
      pagination: result.pagination,
    };
  }

  async getAccessibleFileById(id: Identifier, user: AnyRecord, includeData = false) {
    const item = await db.findById(this.collection, id);
    if (!item) {
      throw ApiError.notFound('File record not found');
    }

    const canReadAll = ['admin', 'staff', 'researcher'].includes(String(user?.role || ''));
    const uploadedBy = normalizeNumericId(user?.id);
    const itemUploader = normalizeNumericId(item.uploadedBy);

    if (!canReadAll && uploadedBy !== itemUploader) {
      throw ApiError.forbidden('Not authorized to view this file');
    }

    return this.sanitizeRecord(item, includeData);
  }
}

export default new FileService();
