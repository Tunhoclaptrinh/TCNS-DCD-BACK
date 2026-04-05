import { defineSchema } from '@app-types/schema';

export default defineSchema({
  idFile: {
    type: 'string',
    required: false,
    unique: true,
    description: 'ID file tren he thong luu tru',
  },
  urlFile: {
    type: 'string',
    required: true,
    description: 'URL truy cap file',
  },
  uploadedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'ID user thuc hien upload',
  },
  fileType: {
    type: 'string',
    required: false,
    description: 'Loai file nhu image, pdf, file...',
  },
  mimeType: {
    type: 'string',
    required: false,
    description: 'MIME type cua file',
  },
  provider: {
    type: 'string',
    required: false,
    description: 'Nha cung cap luu tru',
  },
  filename: {
    type: 'string',
    required: false,
    description: 'Ten file sau khi upload',
  },
  extension: {
    type: 'string',
    required: false,
    description: 'Phan mo rong file',
  },
  bytes: {
    type: 'number',
    required: false,
    description: 'Dung luong file tinh theo bytes',
  },
  data: {
    type: 'string',
    required: false,
    description: 'Du lieu base64 cua file neu can luu cung DB',
  },
});
