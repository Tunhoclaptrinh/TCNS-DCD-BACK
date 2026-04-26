import path from 'path';
import ApiError from '@utils/api-error';
import BaseService from '@shared/common/base-service';
import filesRepository from '@modules/files/repositories/files.repository';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
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
type SerializableRecord = AnyRecord & {
  toJSON?: () => AnyRecord;
  toObject?: () => AnyRecord;
  _doc?: AnyRecord;
};

const PRIVILEGED_ROLES = new Set(['admin', 'staff', 'researcher']);

function normalizeNumericId(value: Identifier | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toPlainRecord(item: SerializableRecord) {
  if (typeof item.toJSON === 'function') {
    return item.toJSON();
  }

  if (typeof item.toObject === 'function') {
    return item.toObject();
  }

  if (item._doc) {
    return item._doc;
  }

  return item;
}

class FileService extends BaseService {
  constructor() {
    super('files', filesRepository);
  }

  toBoolean(value: unknown, defaultValue = false) {
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

  canReadAllFiles(user: AnyRecord) {
    return PRIVILEGED_ROLES.has(String(user?.role || ''));
  }

  buildAccessFilter(user: AnyRecord, baseFilter: AnyRecord = {}) {
    const filter = { ...baseFilter };
    const uploadedBy = normalizeNumericId(user?.id);

    if (!this.canReadAllFiles(user) && uploadedBy !== null) {
      filter.uploadedBy = uploadedBy;
    }

    return filter;
  }

  // Khong tra base64 mac dinh de response gon hon va tranh phinh payload khong can thiet.
  sanitizeRecord(item: AnyRecord | null | undefined, includeData = false) {
    if (!item) {
      return item;
    }

    const sanitized = { ...toPlainRecord(item) };
    delete sanitized._id;
    delete sanitized.__v;
    sanitized.hasData = Boolean(sanitized.data);

    if (!includeData) {
      delete sanitized.data;
    }

    return sanitized;
  }

  buildPayload(options: SaveFileRecordOptions) {
    const mimeType = String(options.mimeType || 'application/octet-stream');
    const filename = String(options.filename || options.idFile || '');

    return {
      idFile: options.idFile,
      urlFile: options.urlFile,
      sourceType: 'file', // Mac dinh luon la file cho Cloudinary/Storage
      uploadedBy: normalizeNumericId(options.uploadedBy),
      fileType: this.detectFileType(mimeType, filename),
      mimeType,
      provider: options.provider || 'cloudinary',
      filename,
      originalName: options.filename || null,
      extension: path.extname(filename).replace('.', '').toLowerCase() || null,
      bytes: options.bytes ?? null,
      data: this.toBoolean(options.storeData, false) ? this.buildBase64Data(options.dataBuffer, mimeType) : null,
      isPublic: true,
    };
  }

  async findRecordByStorageId(idFile: string) {
    return await filesRepository.findByStorageId(idFile);
  }

  async saveFileRecord(options: SaveFileRecordOptions) {
    const payload = this.buildPayload(options);
    const existing = await this.findRecordByStorageId(payload.idFile);

    if (existing) {
      const updated = await this.repository.update(existing.id, {
        ...payload,
        updatedAt: new Date().toISOString(),
      });

      await auditLogsService.log({
        userId: normalizeNumericId(options.uploadedBy) || 0,
        action: 'CẬP NHẬT FILE',
        module: 'FILES',
        description: `Cập nhật thông tin tập tin: ${payload.filename}`,
        resourceId: String(existing.id),
      });

      return updated;
    }

    const created = await this.create(payload);
    if (!created.success || !created.data) {
      throw ApiError.badRequest(created.message || 'Không thể lưu thông tin tệp');
    }

    await auditLogsService.log({
      userId: normalizeNumericId(options.uploadedBy) || 0,
      action: 'TẢI LÊN FILE',
      module: 'FILES',
      description: `Tải lên tập tin mới: ${payload.filename}`,
      resourceId: String(created.data.id),
    });

    return created.data;
  }

  async createUrlOnly(data: { url: string; filename: string; uploadedBy?: Identifier }) {
    const payload = {
      idFile: `url_${Date.now()}`,
      urlFile: data.url,
      filename: data.filename,
      sourceType: 'url',
      uploadedBy: normalizeNumericId(data.uploadedBy),
      isPublic: true,
      provider: 'external',
    };

    const created = await this.create(payload);

    await auditLogsService.log({
      userId: normalizeNumericId(data.uploadedBy) || 0,
      action: 'TẠO LIÊN KẾT URL',
      module: 'FILES',
      description: `Tạo liên kết URL mới: ${data.filename}`,
      resourceId: String(created.data?.id),
    });

    return created.data;
  }

  async deleteByIdFile(idFile: string, performerId?: Identifier) {
    const items = await this.repository.findMany({ idFile });

    for (const item of items) {
      await this.repository.delete(item.id);
      await auditLogsService.log({
        userId: normalizeNumericId(performerId) || 0,
        action: 'XÓA FILE',
        module: 'FILES',
        description: `Xóa tập tin: ${item.filename}`,
        resourceId: String(item.id),
        dataBefore: item,
      });
    }

    return items.length;
  }

  async getAccessibleFiles(user: AnyRecord, options: QueryOptions = {}, includeData = false) {
    const result = await this.repository.findAllAdvanced({
      ...options,
      filter: this.buildAccessFilter(user, options.filter || {}),
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
    const item = await this.repository.findById(id);
    if (!item) {
      throw ApiError.notFound('Không tìm thấy bản ghi tệp');
    }

    const uploadedBy = normalizeNumericId(user?.id);
    const itemUploader = normalizeNumericId(item.uploadedBy);

    if (!this.canReadAllFiles(user) && uploadedBy !== itemUploader) {
      throw ApiError.forbidden('Bạn không có quyền xem tệp này');
    }

    return this.sanitizeRecord(item, includeData);
  }
}

export default new FileService();
