import type { Identifier } from './common';

export type UploadCategory = 'avatar' | 'general' | 'temp';
export type UploadFolder = 'avatars' | 'general' | 'temp';
export type StorageResourceType = 'image' | 'raw';

export type UploadRecordOptions = {
  uploadedBy?: Identifier | null;
  storeData?: unknown;
};

export type PreparedUploadFile = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  bytes: number;
  extension: string | null;
  format?: string | null;
};

export type CloudinaryAsset = {
  url: string;
  secureUrl: string;
  publicId: string;
  filename: string;
  format?: string | null;
  bytes?: number | null;
  createdAt?: string | null;
  folder: string;
  provider: 'cloudinary';
  resourceType: StorageResourceType;
};
