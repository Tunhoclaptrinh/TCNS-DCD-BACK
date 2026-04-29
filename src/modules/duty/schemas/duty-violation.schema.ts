import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất',
  },
  slotId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_slots',
    description: 'ID Kíp xảy ra lỗi',
  },
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người vi phạm',
  },
  type: {
    type: 'string',
    required: true,
    description: 'Loại lỗi (Vắng mặt, Tác phong, Muộn...)',
  },
  coefficient: {
    type: 'number',
    required: true,
    default: 1,
    description: 'Hệ số lỗi (Mức độ nặng nhẹ)',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú chi tiết lỗi',
  },
  createdBy: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người ghi nhận lỗi (Leader hoặc Admin)',
  },
  createdAt: {
    type: 'string',
    required: false,
    description: 'Thời điểm ghi lỗi',
  },
  penaltyId: {
    type: 'number',
    required: false,
    foreignKey: 'reward_penalties',
    description: 'ID phiếu phạt liên quan',
  },
});
