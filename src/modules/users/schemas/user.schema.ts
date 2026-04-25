import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    label: 'ID Hệ thống',
    hidden: true,
  },
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100,
    label: 'Họ và tên',
  },
  lastName: {
    type: 'string',
    required: false,
    label: 'Họ và tên đệm',
  },
  firstName: {
    type: 'string',
    required: false,
    label: 'Tên',
  },
  gender: {
    type: 'enum',
    enum: ['male', 'female', 'other'],
    required: false,
    label: 'Giới tính',
  },
  dob: {
    type: 'date',
    required: false,
    label: 'Ngày sinh',
  },
  studentId: {
    type: 'string',
    required: false,
    label: 'Mã sinh viên',
  },
  classId: {
    type: 'string',
    required: false,
    label: 'Lớp',
  },
  hometown: {
    type: 'string',
    required: false,
    label: 'Quê quán',
  },
  position: {
    type: 'enum',
    enum: ['ctc', 'tv', 'tvb', 'pb', 'tb', 'dt'],
    required: false,
    label: 'Chức vụ',
  },
  department: {
    type: 'string',
    required: false,
    label: 'Phòng ban/Ban',
  },
  status: {
    type: 'enum',
    enum: ['active', 'inactive', 'dismissed'],
    required: false,
    default: 'active',
    label: 'Trạng thái',
  },
  email: {
    type: 'email',
    required: true,
    unique: true,
    label: 'Email',
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
    label: 'Mật khẩu',
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
    label: 'Số điện thoại',
  },
  address: {
    type: 'string',
    required: false,
    label: 'Địa chỉ',
  },
  role: {
    type: 'enum',
    enum: ['admin', 'staff', 'customer', 'curator'],
    required: false,
    default: 'customer',
    label: 'Vai trò (Legacy)',
  },
  roleIds: {
    type: 'array',
    required: false,
    default: [],
    label: 'Danh sách Vai trò',
  },
  customPermissions: {
    type: 'object',
    required: false,
    default: { extra: [], denied: [] },
    label: 'Quyền tùy chỉnh',
  },
  generationId: {
    type: 'number',
    required: false,
    foreignKey: 'generations',
    label: 'ID Khóa/Thế hệ',
  },

  bio: {
    type: 'string',
    required: false,
    maxLength: 500,
    label: 'Tiểu sử',
  },
  avatar: {
    type: 'string',
    required: false,
    label: 'Ảnh đại diện',
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true,
    label: 'Đang hoạt động',
  },

  lastLogin: {
    type: 'date',
    required: false,
    label: 'Đăng nhập cuối',
    hidden: true,
  },
  expelled: {
    type: 'boolean',
    required: false,
    default: false,
    label: 'Đã bị khai trừ',
    hidden: true,
  },
  expelledAt: {
    type: 'date',
    required: false,
    label: 'Ngày khai trừ',
    hidden: true,
  },
  expelReason: {
    type: 'string',
    required: false,
    maxLength: 500,
    label: 'Lý do khai trừ',
    hidden: true,
  },
  expelledBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    label: 'Người thực hiện khai trừ',
    hidden: true,
  },
  promotedAt: {
    type: 'date',
    required: false,
    label: 'Ngày thăng chức',
    hidden: true,
  },
  promotedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
    label: 'Người thực hiện thăng chức',
    hidden: true,
  },
  promotionReason: {
    type: 'string',
    required: false,
    maxLength: 500,
    label: 'Lý do thăng chức',
    hidden: true,
  },
});
