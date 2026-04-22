import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  weekStart: {
    type: 'date',
    required: true,
  },
  shiftDate: {
    type: 'date',
    required: true,
    description: 'Ngày diễn ra kíp trực (ISO)',
  },
  dayId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_days',
    description: 'ID Ngày trực (Parent)',
  },
  kipId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_kips',
    description: 'ID Kíp (Template)',
  },
  shiftId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_shifts',
    description: 'ID Ca trực (Template)',
  },
  shiftLabel: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên hiển thị (Kíp)',
  },
  startTime: {
    type: 'string',
    required: false,
  },
  endTime: {
    type: 'string',
    required: false,
  },
  capacity: {
    type: 'number',
    required: false,
    default: 1,
    min: 1,
    description: 'Sĩ số tối đa (Đè giá trị của kíp nếu có)',
  },
  assignedUserIds: {
    type: 'array',
    required: false,
    default: [],
  },
  attendedUserIds: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách user id đã điểm danh',
  },
  status: {
    type: 'enum',
    enum: ['open', 'locked'],
    required: false,
    default: 'open',
  },
  createdBy: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người tạo',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  order: {
    type: 'number',
    required: false,
    description: 'Tiết bắt đầu',
  },
  endPeriod: {
    type: 'number',
    required: false,
    description: 'Tiết kết thúc',
  },
  isSpecialEvent: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đánh dấu là sự kiện đặc biệt',
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
