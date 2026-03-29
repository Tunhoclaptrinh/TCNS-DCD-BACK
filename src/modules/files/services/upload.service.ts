import path from 'path';
import fileService from '@modules/files/services/file.service';
import uploadPolicyService from '@modules/files/services/upload-policy.service';
import fileProcessingService from '@modules/files/services/file-processing.service';
import cloudinaryStorageService from '@modules/files/services/cloudinary-storage.service';
import type { AnyRecord } from '@app-types/common';
import type {
  CloudinaryAsset,
  PreparedUploadFile,
  StorageResourceType,
  UploadCategory,
  UploadFolder,
  UploadRecordOptions,
} from '@app-types/upload';

const MANAGED_FOLDERS: UploadFolder[] = ['avatars', 'general', 'temp'];

class UploadService {
  constructor(
    private readonly policyService = uploadPolicyService,
    private readonly processingService = fileProcessingService,
    private readonly storageService = cloudinaryStorageService,
    private readonly recordService = fileService,
  ) {}

  getSingleUpload(fieldName = 'image', category: UploadCategory = 'temp') {
    return this.policyService.buildSingleUploader(fieldName, category);
  }

  getFlexibleSingleUpload(fieldNames: string[] = ['file'], category: UploadCategory = 'temp') {
    return this.policyService.buildFlexibleSingleUploader(fieldNames, category);
  }

  getMultipleUpload(fieldName = 'images', maxCount = 5, category: UploadCategory = 'temp') {
    return this.policyService.buildArrayUploader(fieldName, maxCount, category);
  }

  buildFileRecord(asset: CloudinaryAsset, prepared: PreparedUploadFile, options: UploadRecordOptions) {
    return this.recordService.saveFileRecord({
      idFile: asset.publicId,
      urlFile: asset.secureUrl || asset.url,
      uploadedBy: options.uploadedBy,
      mimeType: prepared.mimeType,
      filename: prepared.filename,
      bytes: prepared.bytes,
      provider: asset.provider,
      dataBuffer: prepared.buffer,
      storeData: options.storeData,
    });
  }

  async finalizeUpload(
    folder: UploadFolder,
    baseName: string,
    prepared: PreparedUploadFile,
    options: UploadRecordOptions = {},
    resourceType?: StorageResourceType,
  ) {
    const asset = await this.storageService.upload({
      buffer: prepared.buffer,
      folder,
      baseName,
      mimeType: prepared.mimeType,
      filename: prepared.filename,
      resourceType,
    });

    try {
      const fileRecord = await this.buildFileRecord(asset, prepared, options);

      return {
        ...asset,
        fileRecord: this.recordService.sanitizeRecord(fileRecord),
      };
    } catch (error) {
      // Neu ghi DB that bai sau khi da upload file, rollback ngay tren Cloudinary de tranh rac du lieu.
      await this.storageService.destroy(asset.publicId, asset.resourceType).catch(() => null);
      throw error;
    }
  }

  async uploadAvatar(file: AnyRecord, userId: string | number, options: UploadRecordOptions = {}) {
    const prepared = await this.processingService.prepareAvatar(file);

    return this.finalizeUpload(
      'avatars',
      `user-${userId}-${Date.now()}`,
      prepared,
      {
        uploadedBy: options.uploadedBy ?? userId,
        storeData: options.storeData,
      },
      'image',
    );
  }

  async uploadGeneralFile(file: AnyRecord, options: UploadRecordOptions = {}) {
    const prepared = await this.processingService.prepareGeneral(file);
    const originalBaseName = path.parse(String(file?.originalname || `file-${Date.now()}`)).name;

    return this.finalizeUpload('general', `${originalBaseName}-${Date.now()}`, prepared, options);
  }

  getPreferredResourceType(record?: AnyRecord | null) {
    if (!record?.mimeType) {
      return null;
    }

    return this.storageService.detectResourceType(record.mimeType);
  }

  async deleteFile(input: string) {
    const publicId = this.storageService.resolvePublicId(input);
    const existingRecord = await this.recordService.findRecordByStorageId(publicId);
    const result = await this.storageService.destroy(publicId, this.getPreferredResourceType(existingRecord));
    const deletedRecords = await this.recordService.deleteByIdFile(publicId);

    return {
      message: 'File deleted successfully',
      publicId,
      deletedRecords,
      provider: 'cloudinary',
      resourceType: result.resourceType,
    };
  }

  async getFileInfo(input: string) {
    const publicId = this.storageService.resolvePublicId(input);
    const existingRecord = await this.recordService.findRecordByStorageId(publicId);
    const asset = await this.storageService.getFileInfo(publicId, this.getPreferredResourceType(existingRecord));

    return {
      ...asset,
      fileRecord: this.recordService.sanitizeRecord(existingRecord),
    };
  }

  async cleanupOldFiles(days = 30) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    let deletedCount = 0;

    for (const folder of MANAGED_FOLDERS) {
      const resources = await this.storageService.listAllResourcesByFolder(folder);
      const oldResources = resources.filter((item) => new Date(String(item.createdAt || 0)).getTime() < cutoff);

      for (const item of oldResources) {
        const result = await this.storageService.destroy(item.publicId, item.resourceType);
        if (result.result === 'ok') {
          await this.recordService.deleteByIdFile(item.publicId);
          deletedCount++;
        }
      }
    }

    return { message: `Deleted ${deletedCount} old files`, deletedCount, provider: 'cloudinary' };
  }

  async getStorageStats() {
    const stats: AnyRecord = { totalSize: 0, totalFiles: 0, byFolder: {}, provider: 'cloudinary' };

    for (const folder of MANAGED_FOLDERS) {
      const resources = await this.storageService.listAllResourcesByFolder(folder);
      const totalSize = resources.reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);

      stats.byFolder[folder] = {
        files: resources.length,
        size: totalSize,
        sizeFormatted: this.storageService.formatBytes(totalSize),
      };

      stats.totalFiles += resources.length;
      stats.totalSize += totalSize;
    }

    stats.totalSizeFormatted = this.storageService.formatBytes(stats.totalSize);
    return stats;
  }
}

export default new UploadService();
