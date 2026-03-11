import { defineSchema } from '@app-types/schema';

export default defineSchema({
  week_start: {
    type: 'date',
    required: true,
    description: 'Ngày bắt đầu tuần (ISO)',
  },
  shift_date: {
    type: 'date',
    required: true,
    description: 'Ngày diễn ra ca trực (ISO)',
  },
  shift_label: {
    type: 'string',
    required: true,
    minLength: 1,
    maxLength: 100,
    description: 'Tên ca trực',
  },
  start_time: {
    type: 'string',
    required: false,
    description: 'Giờ bắt đầu (HH:mm)',
  },
  end_time: {
    type: 'string',
    required: false,
    description: 'Giờ kết thúc (HH:mm)',
  },
  capacity: {
    type: 'number',
    required: false,
    default: 1,
    min: 1,
    description: 'Số lượng thành viên tối đa',
  },
  assigned_user_ids: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách user id đã đăng ký',
  },
  status: {
    type: 'enum',
    enum: ['open', 'locked'],
    required: false,
    default: 'open',
    description: 'Trạng thái ca',
  },
  created_by: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'Người tạo ca trực',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú',
  },
});
