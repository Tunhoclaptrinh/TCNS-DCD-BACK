import { defineSchema } from '@app-types/schema';

export default defineSchema({
  user_id: {
    type: 'number',
    required: true,
    unique: true,
    foreignKey: 'users',
    description: 'User sở hữu cài đặt',
  },
  shift_notifications: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/tắt thông báo ca trực',
  },
  approval_notifications: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/tắt thông báo phê duyệt',
  },
  system_notifications: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/tắt thông báo hệ thống',
  },
  email_notifications: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Bật/tắt kênh email',
  },
  sms_notifications: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Bật/tắt kênh sms',
  },
});
