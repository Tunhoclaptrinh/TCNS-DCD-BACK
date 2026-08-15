import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    description: 'ID định danh duy nhất (Numeric)',
  },
  weekStart: {
    type: 'date',
    required: false,
    description: 'Ngày bắt đầu tuần (ISO)',
  },
  shiftDate: {
    type: 'date',
    required: true,
    description: 'Ngày diễn ra kíp trực (ISO)',
  },
  dayId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_days',
  },
  shiftId: {
    type: 'number',
    required: false,
    foreignKey: 'duty_shifts',
  },
  kipId: {
    type: 'number',
    required: true,
    foreignKey: 'duty_kips',
    description: 'ID Kíp thực tế cha (Bắt buộc theo kế hoạch)',
  },

  shiftLabel: {
    type: 'string',
    required: false,
    description: 'Nhãn ca/kíp hiển thị (e.g., Ca Sáng - Kíp 1)',
  },
  startTime: {
    type: 'string',
    required: false,
    description: 'Giờ bắt đầu kíp trực thực tế (HH:mm)',
  },
  endTime: {
    type: 'string',
    required: false,
    description: 'Giờ kết thúc kíp trực thực tế (HH:mm)',
  },
  capacity: {
    type: 'number',
    required: false,
    default: 1,
    min: 1,
    description: 'Sĩ số tối đa (Đè giá trị của kíp nếu có)',
  },
  coefficient: {
    type: 'number',
    required: false,
    default: 1,
    min: 0.25,
    description: 'Số kíp được tính cho kíp này',
  },
  assignedUserIds: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách ID người dùng được phân công/đăng ký vào kíp',
  },
  attendedUserIds: {
    type: 'array',
    required: false,
    default: [],
    description: 'Danh sách ID người dùng có mặt thực tế (đã điểm danh)',
  },
  tempLeaderId: {
    type: 'number',
    required: false,
    description: 'ID người giữ quyền quản lý kíp tạm thời',
  },
  attendanceData: {
    type: 'object',
    required: false,
    default: {},
    description: 'Dữ liệu điểm danh chi tiết (userId -> {time, ip, method, markedBy})',
  },
  attendanceOverrides: {
    type: 'object',
    required: false,
    default: {},
    description: 'Hệ số kíp thực tế tùy chỉnh theo từng nhân sự (userId -> customCoefficient)',
  },
  isSpecialEvent: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đánh dấu kíp thuộc sự kiện đặc biệt',
  },
  status: {
    type: 'enum',
    enum: ['open', 'locked'],
    required: false,
    default: 'open',
    description: 'Trạng thái kíp trực: open (mở đăng ký) | locked (đã khóa)',
  },
  createdBy: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    description: 'ID Quản trị viên/Người tạo kíp',
  },
  note: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Ghi chú công việc hoặc nhiệm vụ cụ thể của kíp',
  },
  config: {
    type: 'object',
    required: false,
    default: {},
    description:
      'Cấu hình nâng cao: visibilityMode (public | protect_members | private_mutual | hidden_all), privacyMaskType (masked | omitted), v.v.',
  },
  slotStructure: {
    type: 'array',
    required: false,
    default: [],
    description: 'Cơ cấu nhân sự thực tế cho kíp này (chỉ tiêu theo ngạch/vai trò)',
  },
});
