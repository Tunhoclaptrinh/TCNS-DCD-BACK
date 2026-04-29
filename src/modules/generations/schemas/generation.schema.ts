import type { SchemaDefinition } from '@app-types/schema';

const generationSchema: SchemaDefinition = {
  name: {
    type: 'string',
    required: true,
    unique: true,
    maxLength: 100,
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
