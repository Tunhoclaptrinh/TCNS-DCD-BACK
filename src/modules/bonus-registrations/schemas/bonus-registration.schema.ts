import { defineSchema } from '@app-types/schema';

export default defineSchema({
  campaignId: {
    type: 'number',
    description: 'ID của đợt cộng điểm.',
    required: true,
    foreignKey: 'bonus_campaigns',
  },
  userId: {
    type: 'number',
    description: 'ID của thành viên đăng ký.',
    required: true,
    foreignKey: 'users',
  },
  status: {
    type: 'enum',
    description: 'Trạng thái đăng ký.',
    enum: ['registered', 'approved', 'rejected'],
    required: true,
    default: 'registered',
  },
  dutyHours: {
    type: 'number',
    description: 'Số giờ trực tích lũy tại thời điểm xét.',
    required: false,
    default: 0,
  },
  absenceRate: {
    type: 'number',
    description: 'Tỷ lệ vắng tại thời điểm xét.',
    required: false,
    default: 0,
  },
  eligible: {
    type: 'boolean',
    description: 'Đánh giá có đạt điều kiện hay không.',
    required: false,
    default: false,
  },
  registeredAt: {
    type: 'date',
    description: 'Thời điểm đăng ký.',
    required: true,
  },
  reviewedAt: {
    type: 'date',
    description: 'Thời điểm xét duyệt.',
    required: false,
  },
  reviewedBy: {
    type: 'number',
    description: 'ID người thực hiện xét duyệt.',
    required: false,
    foreignKey: 'users',
  },
  note: {
    type: 'string',
    description: 'Ghi chú đăng ký/xét duyệt.',
    required: false,
    maxLength: 1000,
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
