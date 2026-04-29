import type { SchemaDefinition } from '@app-types/schema';

const generationSchema: SchemaDefinition = {
  name: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
  },
  maNamHoc: {
    type: 'string',
    description: 'Mã năm học dùng chung, ví dụ: 2026.',
    required: false,
    maxLength: 10,
  },
  maKhoa: {
    type: 'string',
    description: 'Mã khóa dùng chung, ví dụ: 20261.',
    required: false,
    unique: true,
    maxLength: 20,
  },
  description: {
    type: 'string',
    required: false,
    maxLength: 500,
  },
  isCurrent: {
    type: 'boolean',
    required: true,
    default: false,
  },
  isActive: {
    type: 'boolean',
    required: true,
    default: true,
  },
  createdAt: {
    type: 'date',
    required: false,
  },
  updatedAt: {
    type: 'date',
    required: false,
  },
};

export default generationSchema;
