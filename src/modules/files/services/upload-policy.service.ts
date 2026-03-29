import multer from 'multer';
import type { UploadCategory } from '@app-types/upload';

type UploadRule = {
  allowedMimeTypes: Set<string>;
  maxFileSize: number;
};

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']);
const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
]);

const GENERAL_MIME_TYPES = new Set([...IMAGE_MIME_TYPES, ...DOCUMENT_MIME_TYPES]);

const CATEGORY_RULES: Record<UploadCategory, UploadRule> = {
  avatar: {
    allowedMimeTypes: IMAGE_MIME_TYPES,
    maxFileSize: 5 * 1024 * 1024,
  },
  general: {
    allowedMimeTypes: GENERAL_MIME_TYPES,
    maxFileSize: 10 * 1024 * 1024,
  },
  temp: {
    allowedMimeTypes: GENERAL_MIME_TYPES,
    maxFileSize: 10 * 1024 * 1024,
  },
};

class UploadPolicyService {
  getRule(category: UploadCategory = 'temp') {
    return CATEGORY_RULES[category] || CATEGORY_RULES.temp;
  }

  isImageMimeType(mimeType?: string | null) {
    return IMAGE_MIME_TYPES.has(String(mimeType || '').toLowerCase());
  }

  isMimeTypeAllowed(category: UploadCategory, mimeType?: string | null) {
    return this.getRule(category).allowedMimeTypes.has(String(mimeType || '').toLowerCase());
  }

  buildMulterConfig(category: UploadCategory = 'temp') {
    const rule = this.getRule(category);

    return {
      storage: multer.memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (this.isMimeTypeAllowed(category, file.mimetype)) {
          cb(null, true);
          return;
        }

        cb(new Error(`Invalid file type. Allowed: ${[...rule.allowedMimeTypes].join(', ')}`), false);
      },
      limits: { fileSize: rule.maxFileSize },
    };
  }

  // Tach policy rieng de moi luong upload co tap luat rieng, khong de UploadService om luon validation.
  buildSingleUploader(fieldName = 'image', category: UploadCategory = 'temp') {
    return multer(this.buildMulterConfig(category)).single(fieldName);
  }

  // Ho tro giai doan chuyen doi API: chap nhan nhieu ten field nhung chi lay toi da 1 file moi field.
  buildFlexibleSingleUploader(fieldNames: string[] = ['file'], category: UploadCategory = 'temp') {
    const uniqueFieldNames = [...new Set(fieldNames.filter(Boolean))];
    return multer(this.buildMulterConfig(category)).fields(
      uniqueFieldNames.map((name) => ({
        name,
        maxCount: 1,
      })),
    );
  }

  buildArrayUploader(fieldName = 'images', maxCount = 5, category: UploadCategory = 'temp') {
    return multer(this.buildMulterConfig(category)).array(fieldName, maxCount);
  }
}

export default new UploadPolicyService();
