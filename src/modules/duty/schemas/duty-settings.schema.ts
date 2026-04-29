import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất',
  },
  weeklyKipLimit: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Số kíp tối đa một thành viên có thể đăng ký trong tuần',
  },
  allowUnregisterWhenFull: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Cho phép hủy đăng ký ngay cả khi ca đã đầy',
  },
  currentGenerationId: {
    type: 'number',
    required: false,
    description: 'ID thế hệ hiện tại (Dùng cho logic lưu trữ)',
  },
  currentGeneration: {
    type: 'string',
    required: false,
    description: 'Tên thế hệ hiện tại (Legacy)',
  },

  // New Stats & Quota Fields
  defaultQuota: {
    type: 'number',
    required: false,
    default: 2.5,
    description: 'Định mức mặc định (kíp/tuần)',
  },
  kipPrice: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Đơn giá 1 kíp (VNĐ)',
  },
  violationPenaltyRate: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Hệ số phạt vi phạm',
  },
  quotaRules: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách quy tắc định mức chuyên sâu (Ban, Vai trò, Thời gian)',
  },

  updatedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật cuối cùng',
  },
});
