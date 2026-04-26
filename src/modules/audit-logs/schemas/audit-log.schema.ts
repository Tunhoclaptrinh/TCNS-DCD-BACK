import { defineSchema } from '@app-types/schema';

export default defineSchema({
  id: {
    type: 'number',
    required: false,
    unique: true,
    label: 'ID Hệ thống',
    hidden: true,
  },
  userId: {
    type: 'number',
    required: true,
    foreignKey: 'users',
    label: 'Người thực hiện',
  },
  action: {
    type: 'string',
    required: true,
    label: 'Hành động',
  },
  module: {
    type: 'string',
    required: true,
    label: 'Module tác động',
  },
  description: {
    type: 'string',
    required: false,
    label: 'Mô tả chi tiết',
  },
  resourceId: {
    type: 'string',
    required: false,
    label: 'ID đối tượng bị tác động',
  },
  ipAddress: {
    type: 'string',
    required: false,
    label: 'Địa chỉ IP',
  },
  userAgent: {
    type: 'string',
    required: false,
    label: 'Thiết bị thực hiện',
  },
  status: {
    type: 'enum',
    enum: ['success', 'failure'],
    default: 'success',
    required: false,
    label: 'Trạng thái',
  },
  errorMessage: {
    type: 'string',
    required: false,
    label: 'Thông báo lỗi',
  },
});
