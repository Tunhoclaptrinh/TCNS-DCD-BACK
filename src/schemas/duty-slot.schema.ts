import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: true,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  weekStart: {
    type: 'date',
    required: true,
    description: 'Ngày bắt đầu tuần (ISO)',
  },
  shiftDate: {
    type: 'date',
    required: true,
    description: 'Ngày diễn ra ca trực (ISO)',
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
    description: 'ID Kíp trực (Template)',
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
    description: 'Tên ca trực',
  },
  startTime: {
    type: 'string',
    required: false,
    description: 'Giờ bắt đầu (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: false,
    description: 'Giờ kết thúc (HH:mm)',
  },
  capacity: {
    type: 'number',
    required: false,
    default: 1,
    min: 1,
    description: 'Số lượng thành viên tối đa',
  },
  assignedUserIds: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách user id đã đăng ký',
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
    description: 'Trạng thái ca',
  },
  createdBy: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người tạo ca trực',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú',
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
});
