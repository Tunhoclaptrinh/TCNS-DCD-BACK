export default {
  title: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tiêu đề thông báo',
  },
  message: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 500,
    description: 'Nội dung thông báo',
  },
  type: {
    type: 'enum',
    enum: ['system', 'general', 'account', 'security'],
    required: true,
    description: 'Loại thông báo',
  },
  ref_id: {
    type: 'number',
    required: false,
    description: 'ID của di sản/cổ vật liên quan',
  },
  is_read: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đã đọc',
  },
};
