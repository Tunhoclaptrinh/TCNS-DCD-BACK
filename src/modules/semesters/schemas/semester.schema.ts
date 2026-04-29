import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên học kỳ (e.g., Học kỳ 1, Học kỳ 2, Học kỳ Hè)',
  },
  academicYear: {
    type: 'string',
    required: true,
    description: 'Năm học (e.g., 2023-2024)',
  },
  startDate: {
    type: 'date',
    required: true,
    description: 'Thời gian bắt đầu học kỳ',
  },
  endDate: {
    type: 'date',
    required: true,
    description: 'Thời gian kết thúc học kỳ',
  },
  isCurrent: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đánh dấu là học kỳ hiện tại',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú thêm',
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  createdAt: {
    type: 'date',
    required: false,
  },
  updatedAt: {
    type: 'date',
    required: false,
  },
});
