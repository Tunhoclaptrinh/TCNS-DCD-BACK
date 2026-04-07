import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
  },
  title: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  message: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 500,
  },
  type: {
    type: 'enum',
    enum: ['system', 'general', 'account', 'security', 'shift', 'approval'],
    required: true,
  },
  category: {
    type: 'enum',
    enum: ['system', 'shift', 'approval'],
    required: false,
    default: 'system',
  },
  channel: {
    type: 'enum',
    enum: ['in_app', 'email', 'sms'],
    required: false,
    default: 'in_app',
  },
  refId: {
    type: 'number',
    required: false,
  },
  metadata: {
    type: 'object',
    required: false,
  },
  isRead: {
    type: 'boolean',
    required: false,
    default: false,
  },
});
