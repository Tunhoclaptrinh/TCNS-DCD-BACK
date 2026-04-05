import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'Người nhận thông báo',
  },
  title: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tiêu đề thông báo',
  },
  message: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 500,
    description: 'Nội dung thông báo',
  },
  type: {
    type: 'enum',
    enum: ['system', 'general', 'account', 'security', 'shift', 'approval'],
    required: true,
    description: 'Loại thông báo',
  },
  category: {
    type: 'enum',
    enum: ['system', 'shift', 'approval'],
    required: false,
    default: 'system',
    description: 'Nhóm thông báo để áp rule settings',
  },
  channel: {
    type: 'enum',
    enum: ['in_app', 'email', 'sms'],
    required: false,
    default: 'in_app',
    description: 'Kênh gửi thông báo',
  },
  refId: {
    type: 'number',
    required: false,
    description: 'ID bản ghi liên quan',
  },
  metadata: {
    type: 'object',
    required: false,
    description: 'Dữ liệu đính kèm cho UI',
  },
  isRead: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đã đọc',
  },
});
