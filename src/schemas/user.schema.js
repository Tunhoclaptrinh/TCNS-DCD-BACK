export default {
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100,
    description: 'Tên người dùng',
  },
  lastName: {
    type: 'string',
    required: false,
    description: 'Họ và tên đệm',
  },
  firstName: {
    type: 'string',
    required: false,
    description: 'Tên',
  },
  dob: {
    type: 'date',
    required: false,
    description: 'Ngày sinh',
  },
  studentId: {
    type: 'string',
    required: false,
    description: 'Mã số sinh viên',
  },
  classId: {
    type: 'string',
    required: false,
    description: 'Mã lớp',
  },
  hometown: {
    type: 'string',
    required: false,
    description: 'Quê quán',
  },
  position: {
    type: 'enum',
    enum: ['ctc', 'tv', 'tvb', 'pb', 'tb', 'dt'],
    required: false,
    description: 'Chức vụ',
  },
  department: {
    type: 'string',
    required: false,
    description: 'Bộ phận/Phòng ban',
  },
  status: {
    type: 'enum',
    enum: ['active', 'inactive', 'dismissed'],
    required: false,
    default: 'active',
    description: 'Trạng thái nhân sự',
  },
  email: {
    type: 'email',
    required: true,
    unique: true,
    description: 'Email duy nhất',
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    description: 'Mật khẩu (sẽ được hash)',
    custom: (value) => {
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain uppercase, lowercase, and number';
      }
    },
  },
  phone: {
    type: 'string',
    required: false,
    minLength: 10,
    maxLength: 11,
    description: 'Số điện thoại',
  },
  address: {
    type: 'string',
    required: false,
    description: 'Địa chỉ liên lạc',
  },
  role: {
    type: 'enum',
    enum: ['admin', 'staff', 'customer', 'researcher', 'curator'],
    required: false,
    default: 'customer',
    description: 'Vai trò người dùng',
  },

  bio: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Tiểu sử',
  },
  avatar: {
    type: 'string',
    required: false,
    description: 'Avatar URL',
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true,
    description: 'Trạng thái hoạt động',
  },
  isOnline: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đang trực tuyến',
  },
  lastSeen: {
    type: 'string',
    required: false,
    description: 'Lần cuối hoạt động (ISO string)',
  },

  lastLogin: {
    type: 'date',
    required: false,
    description: 'Lần cuối đăng nhập (ISO string)',
  },
  expelled: {
    type: 'boolean',
    required: false,
    default: false,
    description: 'Đã bị khai trừ khỏi tổ chức',
  },
  expelledAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm khai trừ',
  },
  expelReason: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Lý do khai trừ',
  },
  expelledBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'ID người thực hiện khai trừ',
  },
  promotedAt: {
    type: 'date',
    required: false,
    description: 'Thời điểm cập nhật chức vụ gần nhất',
  },
  promotedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    description: 'ID người cập nhật chức vụ',
  },
  promotionReason: {
    type: 'string',
    required: false,
    maxLength: 500,
    description: 'Lý do cập nhật chức vụ',
  },
};
