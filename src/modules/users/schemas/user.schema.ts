import { defineSchema } from '@app-types/schema';

export default defineSchema({
  name: {
    type: 'string',
    required: true,
    minLength: 2,
    maxLength: 100,
  },
  lastName: {
    type: 'string',
    required: false,
  },
  firstName: {
    type: 'string',
    required: false,
  },
  dob: {
    type: 'date',
    required: false,
  },
  studentId: {
    type: 'string',
    required: false,
  },
  classId: {
    type: 'string',
    required: false,
  },
  hometown: {
    type: 'string',
    required: false,
  },
  position: {
    type: 'enum',
    enum: ['ctc', 'tv', 'tvb', 'pb', 'tb', 'dt'],
    required: false,
  },
  department: {
    type: 'string',
    required: false,
  },
  status: {
    type: 'enum',
    enum: ['active', 'inactive', 'dismissed'],
    required: false,
    default: 'active',
  },
  email: {
    type: 'email',
    required: true,
    unique: true,
  },
  password: {
    type: 'string',
    required: true,
    minLength: 8,
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
  },
  address: {
    type: 'string',
    required: false,
  },
  role: {
    type: 'enum',
    enum: ['admin', 'staff', 'customer', 'researcher', 'curator'],
    required: false,
    default: 'customer',
  },

  bio: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  avatar: {
    type: 'string',
    required: false,
  },
  isActive: {
    type: 'boolean',
    required: false,
    default: true,
  },

  lastLogin: {
    type: 'date',
    required: false,
  },
  expelled: {
    type: 'boolean',
    required: false,
    default: false,
  },
  expelledAt: {
    type: 'date',
    required: false,
  },
  expelReason: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  expelledBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
  },
  promotedAt: {
    type: 'date',
    required: false,
  },
  promotedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
  },
  promotionReason: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
});
