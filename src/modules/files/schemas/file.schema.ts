import { defineSchema } from '@app-types/schema';

export default defineSchema({
  idFile: {
    type: 'string',
    required: true,
    unique: true,
  },
  urlFile: {
    type: 'string',
    required: true,
  },
  uploadedBy: {
    type: 'number',
    required: false,
    foreignKey: 'users',
  },
  fileType: {
    type: 'string',
    required: false,
  },
  mimeType: {
    type: 'string',
    required: false,
  },
  provider: {
    type: 'string',
    required: false,
  },
  filename: {
    type: 'string',
    required: false,
  },
  extension: {
    type: 'string',
    required: false,
  },
  bytes: {
    type: 'number',
    required: false,
  },
  data: {
    type: 'string',
    required: false,
  },
});
