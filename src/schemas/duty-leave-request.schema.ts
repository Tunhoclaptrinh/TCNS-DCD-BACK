import { defineSchema } from '@app-types/schema';

export default defineSchema({
  slotId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_slots',
    description: 'ID kíp trực cần xin nghỉ',
  },
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'ID người xin nghỉ',
  },
  reason: {
    type: 'string',
    required: true,
    maxLength: 500,
    description: 'Lý do xin nghỉ',
  },
  status: {
    type: 'enum',
    enum: ['pending', 'approved', 'rejected'],
    required: false,
    default: 'pending',
    description: 'Trạng thái phê duyệt',
  },
  approvedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'Người phê duyệt',
  },
  rejectionReason: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Lý do từ chối',
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
