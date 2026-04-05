import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: false,
    unique: true,
    foreignKey: 'users',
    description: 'User sở hữu cài đặt',
  },
  shiftNotifications: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/tắt thông báo lịch trực',
  },
  approvalNotifications: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/tắt thông báo phê duyệt',
  },
  systemNotifications: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/tắt thông báo hệ thống',
  },
  emailNotifications: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Bật/tắt kênh email',
  },
  smsNotifications: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Bật/tắt kênh sms',
  },
});
