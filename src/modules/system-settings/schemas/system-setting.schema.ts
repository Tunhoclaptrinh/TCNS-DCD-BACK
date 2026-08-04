import { SchemaDefinition } from '@app-types/schema';

const schema: SchemaDefinition = {
  key: { type: 'string', required: true, unique: true },
  value: { type: 'string' },
  type: { type: 'string', enum: ['string', 'number', 'boolean', 'json'], default: 'string' },
  description: { type: 'string' },
  updatedBy: { type: 'number', foreignKey: 'users' },
};

export default schema;
