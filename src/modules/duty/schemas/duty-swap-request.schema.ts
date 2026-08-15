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
    description: 'ID người tạo yêu cầu đổi kíp',
  },
  ...baseDutyRequestFields,
  decisionNote: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú phê duyệt hoặc lý do từ chối',
  },
  approvedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm duyệt/xử lý yêu cầu',
  },
});
