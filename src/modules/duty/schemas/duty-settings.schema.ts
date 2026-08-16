import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất',
  },
  weeklyLimitEnabled: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Bật/Tắt tính năng giới hạn kíp trực theo tuần',
  },
  weeklyKipLimit: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Số kíp trực tối đa mỗi tuần (0 là không giới hạn)',
  },
  allowUnregisterWhenFull: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Cho phép thành viên tự hủy đăng ký khi kíp đã đủ người',
  },
  kipLimitMode: {
    type: 'string',
    required: false,
    enum: ['fixed', 'quota'],
    default: 'quota',
    description: 'Chế độ giới hạn: cố định hoặc theo định mức (quota)',
  },
  allowedIpRanges: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách dải IP được phép điểm danh',
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
  penaltyWrongUniform: {
    type: 'number',
    required: false,
    default: 10000,
    description: 'Tiền phạt sai tác phong / trang phục (VNĐ)',
  },
  violationTypes: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách cấu hình loại vi phạm',
  },
  defaultQuota: {
    type: 'number',
    required: false,
    default: 2.5,
    description: 'Định mức kíp trực tối thiểu mặc định toàn hệ thống (kíp)',
  },
  kipPrice: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Đơn giá tiền trực mặc định toàn hệ thống (VNĐ/kíp)',
  },
  violationPenaltyRate: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Hệ số phạt vi phạm mặc định toàn hệ thống',
  },
  quotaRules: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách quy tắc định mức phân cấp toàn hệ thống',
  },
  selfCheckInBeforeMinutes: {
    type: 'number',
    required: false,
    default: 15,
    description: 'Số phút được phép tự điểm danh trước khi kíp trực bắt đầu',
  },
  selfCheckInAfterMinutes: {
    type: 'number',
    required: false,
    default: 15,
    description: 'Số phút được phép tự điểm danh sau khi kíp trực kết thúc',
  },
  updatedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật cuối cùng',
  },
});
