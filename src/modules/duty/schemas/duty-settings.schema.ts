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
  allowedIpRanges: {
    type: 'string',
    required: false,
    default: '',
    description: 'Dải IP cho phép điểm danh (ngăn cách bởi dấu phẩy)',
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
  updatedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật cuối cùng',
  },
});
