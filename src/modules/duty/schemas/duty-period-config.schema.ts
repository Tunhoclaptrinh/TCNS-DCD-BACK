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
    description: 'Định mức kíp trực tối thiểu mặc định cho giai đoạn (kíp)',
  },
  kipPrice: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Đơn giá tiền trực mỗi kíp (VNĐ)',
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
    description: 'Danh sách quy tắc định mức riêng cho giai đoạn này',
  },
  isInitialized: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Đánh dấu giai đoạn đã được khởi tạo cấu hình riêng',
  },
  note: {
    type: 'string',
    required: false,
    description: 'Ghi chú tuần / giai đoạn',
  },
  penaltyAbsentNoPermission: {
    type: 'number',
    required: false,
    description: 'Tiền phạt vắng trực không phép (VNĐ)',
  },
  penaltyAbsentWithPermissionLate: {
    type: 'number',
    required: false,
    description: 'Tiền phạt vắng trực báo muộn (VNĐ)',
  },
  penaltyLate: {
    type: 'number',
    required: false,
    description: 'Tiền phạt đi trực muộn (VNĐ)',
  },
  updatedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật cuối cùng',
  },
});
