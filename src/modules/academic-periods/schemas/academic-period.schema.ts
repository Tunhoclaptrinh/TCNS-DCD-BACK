import { defineSchema } from '@app-types/schema';

export default defineSchema({
  tenHocKy: {
    type: 'string',
    description: 'Tên học kỳ, ví dụ: Học kỳ 1.',
    required: true,
    maxLength: 100,
  },
  tenNamHoc: {
    type: 'string',
    description: 'Tên năm học, ví dụ: 2025-2026.',
    required: false,
    maxLength: 100,
  },
  ma: {
    type: 'string',
    description: 'Mã năm học (thường lấy năm hiện tại), ví dụ: 2026.',
    required: true,
    maxLength: 10,
  },
  maHocKy: {
    type: 'string',
    description: 'Mã học kỳ duy nhất (ma + STT), ví dụ: 20261.',
    required: true,
    unique: true,
    maxLength: 20,
  },
  moTa: {
    type: 'string',
    description: 'Mô tả chi tiết về học kỳ.',
    required: false,
    maxLength: 500,
  },
  active: {
    type: 'boolean',
    description: 'Trạng thái hoạt động của học kỳ.',
    required: true,
    default: true,
  },
  createdAt: {
    type: 'date',
    required: false,
  },
  updatedAt: {
    type: 'date',
    required: false,
  },
});
