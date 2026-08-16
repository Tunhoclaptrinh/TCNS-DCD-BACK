import { defineSchema } from '@app-types/schema';
import { userProfileFields } from './user-profile.base';
import { userAcademicFields } from './user-academic.base';
import { userStatusFields } from './user-status.base';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    label: 'ID Hệ thống',
    hidden: true,
  },

  ...userProfileFields,
  ...userAcademicFields,
  ...userStatusFields,

  password: {
    type: 'string',
    required: true,
    minLength: 8,
    label: 'Mật khẩu',
    hidden: true,
    custom: (value: string) => {
      if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
        return 'Password must contain uppercase, lowercase, and number';
      }
    },
  },
  roleIds: {
    type: 'array',
    required: false,
    default: [],
    label: 'Danh sách Vai trò',
    hidden: true, // auto-assigned from position, not imported directly
  },
  customPermissions: {
    type: 'object',
    required: false,
    default: { extra: [], denied: [] },
    label: 'Quyền tùy chỉnh',
  },
  lastLogin: {
    type: 'date',
    required: false,
    label: 'Đăng nhập cuối',
    hidden: true,
  },
});
