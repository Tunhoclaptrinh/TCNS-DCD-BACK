import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: true,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  name: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên bản mẫu (e.g., Mùa Đông, Mùa Hè)',
  },
  isDefault: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Bản mẫu mặc định',
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
});
