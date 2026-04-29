import { defineSchema } from '@app-types/schema';

export default defineSchema({
  fromSlotId: {
    type: 'number',
    required: true,
    description: 'ID kíp trực hiện tại cần đổi đi',
  },
  toSlotId: {
    type: 'number',
    required: true,
    description: 'ID kíp trực muốn chuyển sang',
  },
  requesterId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
  },
  targetUserId: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'Người nhận đổi (nếu có)',
  },
  reason: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 500,
  },
  status: {
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    required: false,
    default: 'pending',
  },
  decisionNote: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  approvedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
  },
  approvedAt: {
    type: 'date',
    required: false,
  },
});
