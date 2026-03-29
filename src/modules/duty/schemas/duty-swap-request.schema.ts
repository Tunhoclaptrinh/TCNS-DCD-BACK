import { defineSchema } from '@app-types/schema';

export default defineSchema({
  dutySlotId: {
    type: 'number',
    required: true,
    description: 'ID ca trực cần đổi',
  },
  requesterId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người yêu cầu đổi ca',
  },
  targetUserId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người được đề nghị nhận ca',
  },
  reason: {
    type: 'string',
    required: true,
    minLength: 3,
    maxLength: 500,
    description: 'Lý do đổi ca',
  },
  status: {
    type: 'enum',
    enum: ['pending', 'approved', 'rejected', 'cancelled'],
    required: false,
    default: 'pending',
    description: 'Trạng thái duyệt',
  },
  decisionNote: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Lý do phê duyệt/từ chối',
  },
  approvedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'Người duyệt',
  },
  approvedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm duyệt',
  },
});
