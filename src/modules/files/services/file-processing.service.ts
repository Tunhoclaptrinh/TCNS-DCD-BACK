import path from 'path';
import sharp from 'sharp';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';
import type { PreparedUploadFile } from '@app-types/upload';
import uploadPolicyService from '@modules/files/services/upload-policy.service';

const FORMAT_MAP = {
  jpeg: (instance: sharp.Sharp, quality: number) => instance.jpeg({ quality }),
  png: (instance: sharp.Sharp, quality: number) => instance.png({ quality }),
  webp: (instance: sharp.Sharp, quality: number) => instance.webp({ quality }),
};

type ImageTransformOptions = {
  width?: number | null;
  height?: number | null;
  quality?: number;
  format?: keyof typeof FORMAT_MAP;
  fit?: keyof sharp.FitEnum;
};

class FileProcessingService {
  ensureFileBuffer(file: AnyRecord) {
    if (!file?.buffer) {
      throw ApiError.badRequest('No file data received');
    }

    return file.buffer as Buffer;
  }

  buildPreparedFile(
    file: AnyRecord,
    buffer: Buffer,
    mimeType: string,
    bytes: number,
    format?: string | null,
    filename?: string | null,
  ): PreparedUploadFile {
    const safeFilename = String(filename || file?.originalname || `file-${Date.now()}`);

    return {
      buffer,
      mimeType,
      bytes,
      format: format || null,
      filename: safeFilename,
      extension: path.extname(safeFilename).replace('.', '').toLowerCase() || null,
    };
  }

  async transformImage(file: AnyRecord, options: ImageTransformOptions): Promise<PreparedUploadFile> {
    const inputBuffer = this.ensureFileBuffer(file);
    const { width = null, height = null, quality = 80, format = 'jpeg', fit = 'cover' } = options;

    let imageProcessor = sharp(inputBuffer, { animated: false });
    if (width || height) {
      imageProcessor = imageProcessor.resize(width, height, { fit });
    }

    const applyFormat = FORMAT_MAP[format];
    if (applyFormat) {
      imageProcessor = applyFormat(imageProcessor, quality);
    }

    const { data, info } = await imageProcessor.toBuffer({ resolveWithObject: true });

    return this.buildPreparedFile(
      file,
      data,
      `image/${info.format || format}`,
      info.size,
      info.format || format,
      `${path.parse(String(file?.originalname || 'file')).name}.${info.format || format}`,
    );
  }

  prepareRawFile(file: AnyRecord) {
    const buffer = this.ensureFileBuffer(file);
    const mimeType = String(file?.mimetype || 'application/octet-stream');

    return this.buildPreparedFile(
      file,
      buffer,
      mimeType,
      buffer.length,
      path.extname(String(file?.originalname || '')).slice(1),
    );
  }

  async prepareAvatar(file: AnyRecord) {
    if (!uploadPolicyService.isImageMimeType(file?.mimetype)) {
      throw ApiError.badRequest('Avatar must be an image');
    }

    // Avatar được chuẩn hóa về JPEG và kích thước cố định để frontend hiển thị ổn định.
    return this.transformImage(file, {
      width: 200,
      height: 200,
      quality: 85,
      format: 'jpeg',
      fit: 'cover',
    });
  }

  async prepareGeneral(file: AnyRecord) {
    if (uploadPolicyService.isImageMimeType(file?.mimetype)) {
      return this.transformImage(file, {
        width: 1200,
        height: 1200,
        quality: 85,
        format: 'jpeg',
        fit: 'inside',
      });
    }

    return this.prepareRawFile(file);
  }
}

export default new FileProcessingService();
