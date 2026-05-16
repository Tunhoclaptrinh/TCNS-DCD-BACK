import { defineSchema } from '@app-types/schema';
import { baseDutyRequestFields } from './duty-request.base';

export default defineSchema({
  slotId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_slots',
    description: 'ID kíp trực cần xin nghỉ',
  },
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'ID người xin nghỉ',
  },
  ...baseDutyRequestFields,
  rejectionReason: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Lý do từ chối',
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
