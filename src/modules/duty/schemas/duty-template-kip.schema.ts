import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất cho Kíp Bản Mẫu',
  },
  templateShiftId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_template_shifts',
    description: 'ID Ca Bản mẫu cha',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên kíp mẫu (e.g., Kíp 1, Kíp 2)',
  },
  coefficient: {
    type: 'number',
    required: true,
    default: 1,
    description: 'Số kíp được tính',
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
    description: 'Thứ trong tuần áp dụng',
  },
  order: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Thứ tự hiển thị',
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  slotStructure: {
    type: 'array',
    required: false,
    default: [],
    description: 'Cơ cấu nhân sự mẫu',
  },
  config: {
    type: 'object',
    required: false,
    default: {},
  },
});
