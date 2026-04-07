import { defineSchema } from '@app-types/schema';

export default defineSchema({
  weekStart: {
    type: 'date',
    required: true,
  },
  shiftDate: {
    type: 'date',
    required: true,
  },
  shiftLabel: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  startTime: {
    type: 'string',
    required: false,
  },
  endTime: {
    type: 'string',
    required: false,
  },
  capacity: {
    type: 'number',
    required: false,
    default: 1,
    min: 1,
  },
  assignedUserIds: {
    type: 'array',
    required: false,
    default: [],
  },
  status: {
    type: 'enum',
    enum: ['open', 'locked'],
    required: false,
    default: 'open',
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
