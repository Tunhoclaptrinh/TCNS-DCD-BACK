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
    required: false,
    description: 'Ngày bắt đầu tuần (ISO)',
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
  },
  shiftId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_shifts',
  },
  kipId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_kips',
    description: 'ID Kíp thực tế cha (Bắt buộc theo kế hoạch)',
  },

  shiftLabel: {
    type: 'string',
    required: false,
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
  config: {
    type: 'object',
    required: false,
    default: {},
    description: 'Cấu hình nâng cao (Privacy, visibility, etc.)',
  },
});
