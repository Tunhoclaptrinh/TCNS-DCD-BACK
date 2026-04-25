import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  date: {
    type: 'date',
    required: true,
    unique: true,
    description: 'Ngày trực (ISO)',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú cho ngày này (e.g., Ngày lễ, Sự kiện đặc biệt)',
  },
  status: {
    type: 'enum',
    enum: ['open', 'locked'],
    required: false,
    default: 'open',
    description: 'Trạng thái khóa/mở cho toàn bộ ngày',
  },
  metadata: {
    type: 'object',
    required: false,
    description: 'Thông tin bổ sung tùy chỉnh',
  },
});
