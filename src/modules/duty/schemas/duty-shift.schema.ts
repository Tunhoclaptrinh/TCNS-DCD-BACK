import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  dayId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_days',
    description: 'ID Ngày trực thực tế',
  },
  date: {
    type: 'date',
    required: true,
    description: 'Ngày trực cụ thể (ISO Date)',
  },

  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên ca thực tế (e.g., Ca Sáng)',
  },
  startTime: {
    type: 'string',
    required: true,
    description: 'Giờ bắt đầu (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: true,
    description: 'Giờ kết thúc (HH:mm)',
  },
  status: {
    type: 'string',
    required: false,
    default: 'open',
    description: 'Trạng thái ca (open, locked)',
  },
  fromTemplateShiftId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_template_shifts',
    description: 'ID Ca bản mẫu gốc (nếu có)',
  },
  createdBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'Người tạo ca này',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  isSpecialEvent: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đánh dấu là sự kiện đặc biệt',
  },
  slotStructure: {
    type: 'array',
    required: false,
    default: [],
    description: 'Cơ cấu nhân sự thực tế (kế thừa từ bản mẫu)',
  },
});
