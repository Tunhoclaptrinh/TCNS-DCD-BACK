import { defineSchema } from '@app-types/schema';

export default defineSchema({
  semesterId: {
    type: 'number',
    description: 'ID học kỳ liên kết với semesters.',
    required: true,
    foreignKey: 'semesters',
  },
  maDot: {
    type: 'string',
    description: 'Mã đợt cộng điểm (semesterId + STT), ví dụ: 11.',
    required: true,
    unique: true,
    maxLength: 30,
  },
  pointType: {
    type: 'enum',
    description: 'Loại điểm: drl (Điểm rèn luyện) hoặc hb (Học bổng/Ưu tiên).',
    enum: ['drl', 'hb'],
    required: true,
    default: 'drl',
  },
  moTa: {
    type: 'string',
    description: 'Mô tả đợt cộng điểm.',
    required: false,
    maxLength: 500,
  },
  thoiGianBatDau: {
    type: 'date',
    description: 'Thời gian bắt đầu nhận đăng ký.',
    required: true,
  },
  thoiGianKetThuc: {
    type: 'date',
    description: 'Thời gian kết thúc nhận đăng ký.',
    required: true,
  },
  active: {
    type: 'boolean',
    description: 'Trạng thái hoạt động.',
    required: true,
    default: true,
  },
  // Các trường tiêu chí vẫn giữ lại để phục vụ logic xét duyệt tự động
  minDutyHours: {
    type: 'number',
    description: 'Số giờ trực tối thiểu.',
    required: false,
    default: 0,
  },
  maxAbsenceRate: {
    type: 'number',
    description: 'Tỷ lệ vắng tối đa.',
    required: false,
    default: 1,
  },
  createdAt: {
    type: 'date',
    required: false,
  },
  updatedAt: {
    type: 'date',
    required: false,
  },
});
