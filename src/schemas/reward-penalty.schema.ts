import { defineSchema } from '@app-types/schema';

export default defineSchema({
  user_id: {
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
  event_date: {
    type: 'date',
    required: false,
    description: 'Ngày phát sinh (ISO)',
  },
  created_by: {
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
