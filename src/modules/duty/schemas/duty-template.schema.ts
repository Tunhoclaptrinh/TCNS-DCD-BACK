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
    description: 'Tên bản mẫu (e.g., Mùa Đông, Mùa Hè, Ca Sáng, Kíp 1)',
  },
  type: {
    type: 'string',
    required: true,
    enum: ['group', 'shift', 'kip'],
    default: 'group',
    description: 'Loại bản mẫu: nhóm, ca, hoặc kíp',
  },
  parentId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_templates',
    description: 'ID cha (nếu type là shift thì parentId là group, nếu là kip thì parentId là shift)',
  },
  isDefault: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Bản mẫu mặc định (chỉ áp dụng cho type group)',
  },
  startTime: {
    type: 'string',
    required: false,
    description: 'Giờ bắt đầu (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: false,
    description: 'Giờ kết thúc (HH:mm)',
  },
  daysOfWeek: {
    type: 'array',
    items: { type: 'number' },
    required: false,
    default: [0, 1, 2, 3, 4, 5, 6],
    description: 'Các thứ áp dụng trong tuần',
  },
  isSpecialEvent: {
    type: 'boolean',
    required: false,
    default: false,
  },
  coefficient: {
    type: 'number',
    required: false,
    default: 1,
    description: 'Hệ số tính kíp (áp dụng cho kip)',
  },
  capacity: {
    type: 'number',
    required: false,
    default: 1,
    min: 1,
    description: 'Số lượng người đăng ký tối đa (áp dụng cho kip)',
  },
  order: {
    type: 'number',
    required: false,
    default: 0,
    description: 'Thứ tự hiển thị',
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  slotStructure: {
    type: 'array',
    required: false,
    default: [],
    description: 'Cơ cấu nhân sự mẫu',
  },
  config: {
    type: 'object',
    required: false,
    default: {},
  },
  defaultQuota: {
    type: 'number',
    required: false,
    description: 'Định mức kíp mặc định (áp dụng cho group)',
  },
  kipPrice: {
    type: 'number',
    required: false,
    description: 'Đơn giá kíp (áp dụng cho group)',
  },
  quotaRules: {
    type: 'array',
    required: false,
    description: 'Danh sách quy tắc định mức chi tiết (áp dụng cho group)',
  },
});
