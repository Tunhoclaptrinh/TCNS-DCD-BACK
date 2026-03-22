import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: true,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên ca trực (e.g., Ca Sáng, Ca Chiều)',
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
});
