import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
  },
  type: {
    type: 'enum',
    enum: ['reward', 'penalty'],
    required: true,
  },
  amount: {
    type: 'number',
    required: true,
    min: 0,
  },
  reason: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 500,
  },
  eventDate: {
    type: 'date',
    required: false,
  },
  createdBy: {
    type: 'number',
    required: true,
    foreignKey: 'users',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
});
