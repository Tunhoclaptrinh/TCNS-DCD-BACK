import { defineSchema } from '@app-types/schema';

export default defineSchema({
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    label: 'Người dùng',
  },
  email: {
    type: 'email',
    required: true,
    label: 'Email nhận OTP',
  },
  purpose: {
    type: 'enum',
    enum: ['reset_password'],
    required: true,
    default: 'reset_password',
    label: 'Mục đích OTP',
  },
  otpHash: {
    type: 'string',
    required: true,
    minLength: 64,
    maxLength: 64,
    label: 'Mã OTP đã băm',
    hidden: true,
  },
  attemptCount: {
    type: 'number',
    required: false,
    default: 0,
    min: 0,
    label: 'Số lần nhập sai OTP',
  },
  maxAttempts: {
    type: 'number',
    required: false,
    default: 5,
    min: 1,
    label: 'Số lần nhập tối đa',
  },
  sentAt: {
    type: 'date',
    required: true,
    label: 'Thời điểm gửi OTP',
  },
  nextResendAt: {
    type: 'date',
    required: false,
    label: 'Thời điểm có thể gửi lại OTP',
  },
  expiresAt: {
    type: 'date',
    required: true,
    label: 'Hạn OTP',
  },
  usedAt: {
    type: 'date',
    required: false,
    label: 'Thời điểm OTP được sử dụng',
  },
  metadata: {
    type: 'object',
    required: false,
    label: 'Thông tin bổ sung',
  },
});
