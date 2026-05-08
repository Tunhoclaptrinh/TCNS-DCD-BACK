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
  updatedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật cuối cùng',
  },
});
