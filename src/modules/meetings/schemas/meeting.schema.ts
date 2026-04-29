import { defineSchema } from '@app-types/schema';

export default defineSchema({
  title: {
    type: 'string',
    description: 'Tiêu đề cuộc họp.',
    required: true,
    minLength: 2,
    maxLength: 200,
  },
  location: {
    type: 'string',
    description: 'Địa điểm diễn ra cuộc họp.',
    required: true,
    minLength: 2,
    maxLength: 255,
  },
  meetingAt: {
    type: 'date',
    description: 'Thời gian bắt đầu cuộc họp (ISO date-time).',
    required: true,
  },
  endAt: {
    type: 'date',
    description: 'Thời gian kết thúc cuộc họp (nếu có).',
    required: false,
  },
  agenda: {
    type: 'string',
    description: 'Nội dung/chương trình họp.',
    required: false,
    maxLength: 5000,
  },
  status: {
    type: 'enum',
    description: 'Trạng thái cuộc họp.',
    enum: ['scheduled', 'completed', 'cancelled'],
    required: false,
    default: 'scheduled',
  },
  participantIds: {
    type: 'array',
    description: 'Danh sách ID thành viên tham gia cuộc họp.',
    required: false,
    default: [],
  },
  confirmations: {
    type: 'array',
    description: 'Danh sách phản hồi RSVP của các thành viên.',
    required: false,
    default: [],
  },
  note: {
    type: 'string',
    description: 'Ghi chú bổ sung cho cuộc họp.',
    required: false,
    maxLength: 1000,
  },
  createdBy: {
    type: 'number',
    description: 'ID người tạo lịch họp.',
    required: true,
    foreignKey: 'users',
  },
  updatedBy: {
    type: 'number',
    description: 'ID người cập nhật gần nhất.',
    required: false,
    foreignKey: 'users',
  },
});
