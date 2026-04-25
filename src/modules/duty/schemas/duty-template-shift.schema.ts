import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất cho Ca Bản Mẫu',
  },
  templateId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_templates',
    description: 'ID Nhóm Bản mẫu cha (e.g., Lịch Mùa Đông)',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên ca mẫu (e.g., Ca Sáng, Ca Chiều)',
  },
  startTime: {
    type: 'string',
    required: true,
    description: 'Giờ bắt đầu mẫu (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: true,
    description: 'Giờ kết thúc mẫu (HH:mm)',
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  daysOfWeek: {
    type: 'array',
    items: { type: 'number' },
    required: false,
    default: [0, 1, 2, 3, 4, 5, 6],
    description: 'Các thứ áp dụng trong tuần',
  },
  isSpecialEvent: {
    type: 'boolean',
    required: false,
    default: false,
  },
  order: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Thứ tự hiển thị',
  },
});
