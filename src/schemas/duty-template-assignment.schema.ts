import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: true,
    unique: true,
    description: 'ID định danh duy nhất',
  },
  templateId: {
    type: 'number',
    required: true,
    description: 'ID của Bản mẫu (Template Group)',
  },
  startDate: {
    type: 'date',
    required: true,
    description: 'Ngày bắt đầu áp dụng (ISO)',
  },
  endDate: {
    type: 'date',
    required: true,
    description: 'Ngày kết thúc áp dụng (ISO)',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  createdAt: { type: 'string', required: false },
  updatedAt: { type: 'string', required: false },
});
