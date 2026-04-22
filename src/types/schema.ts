import type { AnyRecord } from './common';

export type SchemaFieldType = 'string' | 'number' | 'boolean' | 'email' | 'date' | 'enum' | 'array' | 'object';

export type SchemaRule = {
  type: SchemaFieldType;
  required?: boolean;
  unique?: boolean;
  default?: any;
  enum?: any[];
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  foreignKey?: string;
  values?: any[];
  label?: string;
  hidden?: boolean;
  custom?: (value: any, data: AnyRecord) => string | void | Promise<string | void>;
};

export type SchemaDefinition = Record<string, SchemaRule>;
export type SchemaMap = Record<string, SchemaDefinition>;

export function defineSchema<T extends SchemaDefinition>(schema: T): T {
  return schema;
}
