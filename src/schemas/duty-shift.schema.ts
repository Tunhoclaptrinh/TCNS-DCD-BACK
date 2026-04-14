import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  templateId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_templates',
    description: 'ID Bản mẫu cha',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên ca (e.g., Ca Sáng, Ca Chiều)',
  },
  startTime: {
    type: 'string',
    required: true,
    description: 'Giờ bắt đầu mặc định (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: true,
    description: 'Giờ kết thúc mặc định (HH:mm)',
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
  daysOfWeek: {
    type: 'array',
    items: { type: 'number' },
    required: false,
    default: [0, 1, 2, 3, 4, 5, 6],
    description: 'Thứ trong tuần áp dụng (0: Thứ 2, ..., 6: Chủ Nhật)',
  },
  isSpecialEvent: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đánh dấu là sự kiện đặc biệt (lễ hội)',
  },
});
