export const userProfileFields = {
  name: {
    type: 'string' as const,
    required: true,
    minLength: 2,
    maxLength: 100,
    label: 'Tên đầy đủ',
  },
  lastName: {
    type: 'string' as const,
    required: true,
    label: 'Họ và tên đệm',
  },
  firstName: {
    type: 'string' as const,
    required: true,
    label: 'Tên',
  },
  gender: {
    type: 'enum' as const,
    enum: ['male', 'female', 'other'],
    required: false,
    label: 'Giới tính',
  },
  dob: {
    type: 'date' as const,
    required: false,
    label: 'Ngày sinh',
  },
  hometown: {
    type: 'string' as const,
    required: false,
    label: 'Quê quán',
  },
  email: {
    type: 'email' as const,
    required: true,
    unique: true,
    label: 'Email',
  },
  phone: {
    type: 'string' as const,
    required: false,
    minLength: 10,
    maxLength: 10,
    label: 'Số điện thoại',
    custom: (value) => {
      const phone = String(value || '').trim();

      if (!/^0[35789]\d{8}$/.test(phone)) {
        return 'Số điện thoại phải gồm 10 chữ số và bắt đầu bằng đầu số di động hợp lệ';
      }

      if (/^(\d)\1+$/.test(phone)) {
        return 'Số điện thoại không hợp lệ';
      }

      const sequences = [
        '012345',
        '123456',
        '234567',
        '345678',
        '456789',
        '987654',
        '876543',
        '765432',
        '654321',
        '543210',
      ];
      if (sequences.some((sequence) => phone.includes(sequence))) {
        return 'Số điện thoại không hợp lệ';
      }
    },
  },
  address: {
    type: 'string' as const,
    required: false,
    label: 'Địa chỉ',
  },
  cccd: {
    type: 'string' as const,
    required: false,
    label: 'Số CCCD',
  },
  bio: {
    type: 'string' as const,
    required: false,
    maxLength: 500,
    label: 'Tiểu sử',
  },
  avatar: {
    type: 'string' as const,
    required: false,
    label: 'Ảnh đại diện',
    hidden: true,
  },
  facebook: {
    type: 'string' as const,
    required: false,
    label: 'Link Facebook',
  },
  joinDate: {
    type: 'date' as const,
    required: false,
    label: 'Ngày vào Đội',
  },
  note: {
    type: 'string' as const,
    required: false,
    label: 'Ghi chú',
  },
};
