import type { AnyRecord } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

const BOOL_VALUES = new Set(['true', 'false', '1', '0']);
const BOOL_TRUTHY = new Set(['true', '1', 'yes']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmpty(value: any) {
  return value === undefined || value === null || value === '';
}

export function validateType(field: string, value: any, rule: SchemaRule) {
  switch (rule.type) {
    case 'string':
      return typeof value !== 'string' ? `${field} must be a string` : null;
    case 'number':
      return isNaN(Number(value)) ? `${field} must be a number` : null;
    case 'boolean':
      return typeof value !== 'boolean' && !BOOL_VALUES.has(String(value).toLowerCase())
        ? `${field} must be true/false`
        : null;
    case 'email':
      return !EMAIL_REGEX.test(value) ? `${field} must be a valid email` : null;
    case 'date':
      return isNaN(new Date(value).getTime()) ? `${field} must be a valid date` : null;
    case 'enum':
      return !rule.enum.includes(value) ? `${field} must be one of: ${rule.enum.join(', ')}` : null;
    case 'array':
      return !Array.isArray(value) ? `${field} must be an array` : null;
    default:
      return null;
  }
}

export function convertValue(_field: string, value: any, rule: SchemaRule) {
  if (value === undefined || value === null) {
    return rule.default !== undefined ? rule.default : null;
  }

  switch (rule.type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return BOOL_TRUTHY.has(String(value).toLowerCase());
    case 'date':
      return new Date(value).toISOString();
    case 'email':
      return String(value).toLowerCase();
    case 'array':
      return Array.isArray(value) ? value : [value];
    default:
      return value;
  }
}

export function validateFieldConstraints(field: string, value: any, rule: SchemaRule) {
  if (rule.min !== undefined && Number(value) < rule.min) return `${field} must be >= ${rule.min}`;
  if (rule.max !== undefined && Number(value) > rule.max) return `${field} must be <= ${rule.max}`;
  if (rule.minLength && value.length < rule.minLength) return `${field} must be at least ${rule.minLength} characters`;
  if (rule.maxLength && value.length > rule.maxLength) return `${field} must be at most ${rule.maxLength} characters`;
  if (rule.enum && !rule.enum.includes(value)) return `${field} must be one of: ${rule.enum.join(', ')}`;
  return null;
}

export function transformBySchema(schema: SchemaDefinition | null, data: AnyRecord) {
  if (!schema) return data;

  const transformed: AnyRecord = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (field in data) {
      transformed[field] = convertValue(field, data[field], rule);
    }
  }
  return transformed;
}
