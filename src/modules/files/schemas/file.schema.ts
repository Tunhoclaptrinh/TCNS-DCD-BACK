import { defineSchema } from '@app-types/schema';

export default defineSchema({
  idFile: {
    type: 'string',
    required: false,
    unique: true,
  },

  sourceType: {
    type: 'enum',
    required: true,
    enum: ['file', 'url'],
    default: 'file',
    label: 'Nguồn file',
  },

  urlFile: {
    type: 'string',
    required: false,
    label: 'Đường dẫn/URL',
  },

  uploadedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    label: 'Người tải lên',
  },

  fileType: {
    type: 'enum',
    default: 'file',
    required: false,
    label: 'Loại tập tin',
  },

  mimeType: {
    type: 'string',
    required: false,
    label: 'Định dạng MIME',
  },

  provider: {
    type: 'string',
    required: false,
    default: 'cloudinary',
    label: 'Nhà cung cấp',
  },

  filename: {
    type: 'string',
    required: false,
    label: 'Tên file lưu trữ',
  },

  originalName: {
    type: 'string',
    required: false,
    label: 'Tên file gốc',
  },

  extension: {
    type: 'string',
    required: false,
    label: 'Phần mở rộng',
  },

  bytes: {
    type: 'number',
    required: false,
    label: 'Dung lượng (bytes)',
  },

  data: {
    type: 'string',
    required: false,
    label: 'Dữ liệu Base64 (nếu có)',
    hidden: true,
  },

  isPublic: {
    type: 'boolean',
    default: true,
    label: 'Công khai',
  },
});
