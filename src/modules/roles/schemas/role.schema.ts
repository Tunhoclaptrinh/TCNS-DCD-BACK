import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất',
  },
  key: {
    type: 'string',
    required: true,
    unique: true,
    description: 'Mã vai trò (ví dụ: admin, staff, member)',
  },
  name: {
    type: 'string',
    required: true,
    description: 'Tên hiển thị của vai trò',
  },
  description: {
    type: 'string',
    required: false,
    description: 'Mô tả chi tiết',
  },
  permissions: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách các mã quyền hạn',
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Trạng thái hoạt động',
  },
});
