import { defineSchema } from '@app-types/schema';

export default defineSchema({
  type: {
    type: 'string',
    required: false,
    enum: ['leave', 'swap_transfer', 'unassigned', 'manual_update', 'violation', 'attendance'],
    description: 'Loại hành động (Đơn nghỉ, Đổi kíp, Gỡ người, Cập nhật kíp, Vi phạm, Điểm danh)',
  },
  action: {
    type: 'string',
    required: true,
    enum: [
      'approved',
      'rejected',
      'transfer',
      'removed',
      'system',
      'assign',
      'cancel',
      'request',
      'report',
      'leader',
      'leader_unmark',
      'attendance',
    ],
    description: 'Hành động cụ thể',
  },
  requestId: {
    type: 'number',
    required: false,
    description: 'ID của đơn gốc (nếu có)',
  },
  slotId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_slots',
    description: 'ID kíp trực liên quan',
  },
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Nhân sự bị tác động trực tiếp',
  },
  performerId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người thực hiện hành động (Admin/Staff/Hệ thống)',
  },
  details: {
    type: 'string',
    required: false,
    description: 'Chi tiết thông tin bổ sung',
  },
  createdAt: {
    type: 'date',
    required: false,
    default: new Date(),
  },
});
