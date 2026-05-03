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
  weeklyLimitEnabled: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/Tắt tính năng giới hạn kíp trực theo tuần',
  },
  kipLimitMode: {
    type: 'string',
    required: false,
    default: 'quota',
    description: 'Chế độ giới hạn: quota (định mức) hoặc manual (cố định)',
  },
  allowedIpRanges: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách dải IP được phép điểm danh',
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
  penaltyAbsentNoPermission: {
    type: 'number',
    required: false,
    default: 50000,
    description: 'Tiền phạt vắng trực không phép (VNĐ)',
  },
  penaltyAbsentWithPermissionLate: {
    type: 'number',
    required: false,
    default: 20000,
    description: 'Tiền phạt vắng trực báo muộn (VNĐ)',
  },
  penaltyLate: {
    type: 'number',
    required: false,
    default: 10000,
    description: 'Tiền phạt đi trực muộn (VNĐ)',
  },
  updatedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật cuối cùng',
  },
});
