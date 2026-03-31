import schemas from '@schemas';
import type { NextFunction, Request, Response } from 'express';
import type { AnyRecord } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';
import { camelizeObjectKeys } from '@utils/case';

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
  requestBody: AnyRecord,
  fieldSelection?: FieldSelection,
) {
  const validationErrors: Record<string, string> = {};

  for (const [field, rule] of Object.entries(schema) as Array<[string, SchemaRule]>) {
    if (fieldSelection && !fieldSelection.includes(field)) continue;

    const fieldValue = requestBody[field];

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

function normalizeRequestBodyKeys(req: Request) {
  req.body = camelizeObjectKeys(req.body);
}

function normalizeFieldSelection(fields: string | string[]): FieldSelection {
  return Array.isArray(fields) ? fields : [fields];
}

function createValidator(entity: string, fieldSelection?: FieldSelection) {
  return (req: Request, res: Response, next: NextFunction) => {
    const schema = resolveEntitySchema(entity);
    if (!schema) return next();

    normalizeRequestBodyKeys(req);
    const validationErrors = collectSchemaValidationErrors(schema, req.body, fieldSelection);
    if (respondWithValidationErrors(res, validationErrors)) return;

    next();
  };
}

export const validateSchema = (entity: string) => createValidator(entity);

export const validateFields = (entity: string, fields: string | string[]) =>
  createValidator(entity, normalizeFieldSelection(fields));

function buildSchemaFieldDocumentation(rule: SchemaRule) {
  const fieldDocumentation = {
    type: rule.type,
    required: rule.required || false,
    description: rule.description || '',
  };

  const constraints: AnyRecord = {};
  if (rule.min !== undefined) constraints.min = rule.min;
  if (rule.max !== undefined) constraints.max = rule.max;
  if (rule.minLength) constraints.minLength = rule.minLength;
  if (rule.maxLength) constraints.maxLength = rule.maxLength;
  if (rule.enum) constraints.enum = rule.enum;
  if (rule.unique) constraints.unique = true;
  if (rule.foreignKey) constraints.foreignKey = rule.foreignKey;

  if (Object.keys(constraints).length > 0) {
    (fieldDocumentation as AnyRecord).constraints = constraints;
  }

  return fieldDocumentation;
}

function buildSchemaFieldSummary(rule: SchemaRule) {
  return {
    type: rule.type,
    required: rule.required || false,
    description: rule.description || '',
  };
}

export const getSchemaDoc = (req: Request, res: Response) => {
  const { entity } = req.params;
  const schema = resolveEntitySchema(entity);

  if (!schema) {
    return res.status(404).json({
      success: false,
      message: `Schema not found for entity: ${entity}`,
    });
  }

  const fields: AnyRecord = {};
  for (const [field, rule] of Object.entries(schema) as Array<[string, SchemaRule]>) {
    fields[field] = buildSchemaFieldDocumentation(rule);
  }

  res.json({
    success: true,
    data: { entity, fields },
  });
};

export const getSchemas = (_req: Request, res: Response) => {
  const schemaDocumentation: AnyRecord = {};

  for (const [entity, schema] of Object.entries(schemas) as Array<[string, SchemaDefinition]>) {
    const fields: AnyRecord = {};
    for (const [field, rule] of Object.entries(schema) as Array<[string, SchemaRule]>) {
      fields[field] = buildSchemaFieldSummary(rule);
    }
    schemaDocumentation[entity] = { entity, fields };
  }

  res.json({
    success: true,
    data: schemaDocumentation,
  });
};
