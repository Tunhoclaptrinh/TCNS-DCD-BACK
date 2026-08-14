import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  shiftId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_shifts',
    description: 'ID Ca thực tế cha',
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
    description: 'Tên kíp thực tế (e.g., Kíp 1)',
  },
  coefficient: {
    type: 'number',
    required: true,
    default: 1,
    min: 0.5,
    description: 'Số kíp được tính',
  },
  capacity: {
    type: 'number',
    required: true,
    default: 1,
    min: 1,
    description: 'Số lượng người đăng ký tối đa',
  },
  startTime: {
    type: 'string',
    required: false,
    description: 'Giờ bắt đầu cụ thể (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: false,
    description: 'Giờ kết thúc cụ thể (HH:mm)',
  },
  fromTemplateKipId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_template_kips',
    description: 'ID Kíp bản mẫu gốc (nếu có)',
  },
  status: {
    type: 'string',
    required: false,
    default: 'open',
    description: 'Trạng thái kíp (open, locked)',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú cụ thể cho kíp này',
  },
  order: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Thứ tự hiển thị',
  },
  slotStructure: {
    type: 'array',
    required: false,
    default: [],
    description: 'Cơ cấu nhân sự thực tế',
  },
  config: {
    type: 'object',
    required: false,
    default: {},
    description:
      'Cấu hình nâng cao: visibilityMode (public | protect_members | private_mutual | hidden_all), privacyMaskType (masked | omitted), v.v.',
  },
});
