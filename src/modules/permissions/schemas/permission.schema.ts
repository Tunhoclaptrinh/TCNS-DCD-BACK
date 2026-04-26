import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
  },
  key: {
    type: 'string',
    required: true,
    unique: true,
    description: 'Mã quyền duy nhất (ví dụ: users:create)',
  },
  name: {
    type: 'string',
    required: true,
    description: 'Tên hiển thị của quyền',
  },
  module: {
    type: 'string',
    required: true,
    description: 'Module thuộc về (ví dụ: users, duty)',
  },
  description: {
    type: 'string',
    required: false,
    description: 'Mô tả chi tiết quyền',
  },
});
