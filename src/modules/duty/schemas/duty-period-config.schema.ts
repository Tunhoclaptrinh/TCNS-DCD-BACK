import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
  },
  startDate: {
    type: 'date',
    required: true,
    description: 'Ngày bắt đầu giai đoạn (Thứ 2)',
  },
  endDate: {
    type: 'date',
    required: true,
    description: 'Ngày kết thúc giai đoạn (Chủ nhật)',
  },
  defaultQuota: {
    type: 'number',
    required: false,
    default: 2.5,
  },
  kipPrice: {
    type: 'number',
    required: false,
    default: 0,
  },
  violationPenaltyRate: {
    type: 'number',
    required: false,
    default: 0,
  },
  quotaRules: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách quy tắc định mức riêng cho giai đoạn này',
  },
  isInitialized: {
    type: 'boolean',
    required: false,
    default: true,
  },
  note: {
    type: 'string',
    required: false,
    description: 'Ghi chú tuần',
  },
  penaltyAbsentNoPermission: {
    type: 'number',
    required: false,
  },
  penaltyAbsentWithPermissionLate: {
    type: 'number',
    required: false,
  },
  penaltyLate: {
    type: 'number',
    required: false,
  },
  updatedAt: {
    type: 'date',
    required: false,
  },
});
