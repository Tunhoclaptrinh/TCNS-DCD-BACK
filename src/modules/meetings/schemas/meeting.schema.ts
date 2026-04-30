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
  isAllParticipants: {
    type: 'boolean',
    description: 'Đánh dấu mời toàn bộ thành viên trong đội.',
    required: false,
    default: false,
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
  // Meeting Minutes Fields
  minutesContent: {
    type: 'string',
    description: 'Nội dung chi tiết của biên bản họp (HTML).',
    required: false,
    maxLength: 20000,
  },
  chairpersonId: {
    type: 'number',
    description: 'ID người chủ trì cuộc họp.',
    required: false,
    foreignKey: 'users',
  },
  secretaryId: {
    type: 'number',
    description: 'ID thư ký ghi biên bản.',
    required: false,
    foreignKey: 'users',
  },
  opinions: {
    type: 'string',
    description: 'Ý kiến của thành viên hoặc tập thể.',
    required: false,
    maxLength: 5000,
  },
  proposals: {
    type: 'string',
    description: 'Kiến nghị, đề xuất.',
    required: false,
    maxLength: 5000,
  },
  minutesStatus: {
    type: 'enum',
    description: 'Trạng thái biên bản họp.',
    enum: ['none', 'draft', 'submitted'],
    required: false,
    default: 'none',
  },
});
