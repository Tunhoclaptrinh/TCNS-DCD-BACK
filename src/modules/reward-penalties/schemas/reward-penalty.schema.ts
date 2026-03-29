import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người được thưởng/phạt',
  },
  type: {
    type: 'enum',
    enum: ['reward', 'penalty'],
    required: true,
    description: 'Loại bản ghi',
  },
  amount: {
    type: 'number',
    required: true,
    min: 0,
    description: 'Số tiền',
  },
  reason: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 500,
    description: 'Lý do thưởng/phạt',
  },
  eventDate: {
    type: 'date',
    required: false,
    description: 'Ngày phát sinh (ISO)',
  },
  createdBy: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người tạo bản ghi',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú thêm',
  },
});
