import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: false,
    unique: true,
    foreignKey: 'users',
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
  },
  systemNotifications: {
    type: 'boolean',
    required: false,
    default: true,
  },
  emailNotifications: {
    type: 'boolean',
    required: false,
    default: false,
  },
  smsNotifications: {
    type: 'boolean',
    required: false,
    default: false,
  },
});
