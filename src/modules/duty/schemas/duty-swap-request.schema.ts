import { defineSchema } from '@app-types/schema';
import { baseDutyRequestFields } from './duty-request.base';

export default defineSchema({
  fromSlotId: {
    type: 'number',
    required: true,
    description: 'ID kíp trực hiện tại cần đổi đi',
  },
  toSlotId: {
    type: 'number',
    required: true,
    description: 'ID kíp trực muốn chuyển sang',
  },
  requesterId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
  },
  ...baseDutyRequestFields,
  decisionNote: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  approvedAt: {
    type: 'date',
    required: false,
  },
});
