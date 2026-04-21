import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  shiftId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_shifts',
    description: 'ID Ca cha',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên kíp (e.g., Kíp 1, Kíp 2)',
  },
  coefficient: {
    type: 'number',
    required: true,
    default: 1,
    description: 'Số kíp được tính (e.g., 0.5, 1)',
  },
  capacity: {
    type: 'number',
    required: true,
    default: 1,
    min: 1,
    description: 'Số lượng người đăng ký tối đa',
  },
  startTime: {
    type: 'string',
    required: false,
    description: 'Giờ bắt đầu cụ thể nếu khác Ca (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: false,
    description: 'Giờ kết thúc cụ thể nếu khác Ca (HH:mm)',
  },
  daysOfWeek: {
    type: 'array',
    items: { type: 'number' },
    required: false,
    default: [0, 1, 2, 3, 4, 5, 6],
    description: 'Thứ trong tuần áp dụng (0: Thứ 2, ..., 6: Chủ Nhật)',
  },
  order: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Tiết bắt đầu',
  },
  endPeriod: {
    type: 'number',
    required: false,
    description: 'Tiết kết thúc (để tạo đoạn dải)',
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú/Địa điểm mặc định',
  },
  slotStructure: {
    type: 'array',
    required: false,
    default: [],
    description: 'Cơ cấu nhân sự (Loại: {label, positions, slots})',
  },
  config: {
    type: 'object',
    required: false,
    default: {},
    description: 'Cấu hình nâng cao (Privacy, visibility, etc.)',
  },
});
