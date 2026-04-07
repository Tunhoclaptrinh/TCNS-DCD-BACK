import schemas from '@schemas';
import type { NextFunction, Request, Response } from 'express';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

const BOOLEAN_STRING_VALUES = new Set(['true', 'false', '1', '0', 'yes', 'no']);
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
type FieldSelection = readonly string[];

function isEmptyInput(value: any) {
  return value === undefined || value === null || value === '';
}

function resolveEntitySchema(entity: string) {
  if (!entity) return null;

  const key = String(entity).trim();
  const lowerKey = key.toLowerCase();

  if (schemas[key]) return schemas[key];
  if (schemas[lowerKey]) return schemas[lowerKey];

  if (!lowerKey.endsWith('s') && schemas[`${lowerKey}s`]) {
    return schemas[`${lowerKey}s`];
  }

  if (lowerKey.endsWith('s') && schemas[lowerKey.slice(0, -1)]) {
    return schemas[lowerKey.slice(0, -1)];
  }

  return null;
}

function getFieldTypeValidationError(field: string, value: any, rule: SchemaRule) {
  switch (rule.type) {
    case 'string':
      if (typeof value !== 'string') return `${field} must be a string`;
      if (rule.minLength && value.length < rule.minLength)
        return `${field} must be at least ${rule.minLength} characters`;
      if (rule.maxLength && value.length > rule.maxLength)
        return `${field} must be at most ${rule.maxLength} characters`;
      break;
    case 'number': {
      if (isNaN(Number(value))) return `${field} must be a number`;
      const num = Number(value);
      if (rule.min !== undefined && num < rule.min) return `${field} must be >= ${rule.min}`;
      if (rule.max !== undefined && num > rule.max) return `${field} must be <= ${rule.max}`;
      break;
    }
    case 'boolean':
      if (typeof value !== 'boolean' && !BOOLEAN_STRING_VALUES.has(String(value).toLowerCase())) {
        return `${field} must be true/false`;
      }
      break;
    case 'email':
      if (!EMAIL_REGEX.test(value)) return `${field} must be a valid email`;
      break;
    case 'date':
      if (isNaN(new Date(value).getTime())) return `${field} must be a valid date`;
      break;
    case 'enum':
      if (!rule.enum.includes(value)) return `${field} must be one of: ${rule.enum.join(', ')}`;
      break;
  }
  return null;
}

function collectSchemaValidationErrors(
  schema: SchemaDefinition,
  requestBody: Request['body'],
  fieldSelection?: FieldSelection,
) {
  const body = requestBody && typeof requestBody === 'object' ? requestBody : {};
  const validationErrors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(schema) as Array<[string, SchemaRule]>) {
    if (fieldSelection && !fieldSelection.includes(field)) continue;

    const fieldValue = body[field];

    if (rule.required && isEmptyInput(fieldValue)) {
      validationErrors[field] = `${field} is required`;
      continue;
    }

    if (!rule.required && isEmptyInput(fieldValue)) continue;

    const fieldError = getFieldTypeValidationError(field, fieldValue, rule);
    if (fieldError) validationErrors[field] = fieldError;
  }

  return validationErrors;
}

function respondWithValidationErrors(res: Response, validationErrors: Record<string, string>) {
  if (Object.keys(validationErrors).length === 0) return false;

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: Object.entries(validationErrors).map(([field, message]) => ({ field, message })),
  });
  return true;
}

function createValidator(entity: string, fieldSelection?: FieldSelection) {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = resolveEntitySchema(entity);
    if (!schema) return next();

    const validationErrors = collectSchemaValidationErrors(schema, req.body, fieldSelection);
    if (respondWithValidationErrors(res, validationErrors)) return;

    next();
  };
}

// Validate toàn bộ payload theo schema của entity tương ứng.
export const validateSchema = (entity: string) => createValidator(entity);

// Validate một nhóm field cụ thể theo schema của entity.
export const validateFields = (entity: string, fields: string | string[]) =>
  createValidator(entity, Array.isArray(fields) ? fields : [fields]);
