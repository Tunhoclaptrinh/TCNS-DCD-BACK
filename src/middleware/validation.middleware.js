import schemas from '@schemas';

const BOOL_VALUES = new Set(['true', 'false', '1', '0', 'yes', 'no']);
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

function resolveSchema(entity) {
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

function validateType(field, value, rule) {
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
      if (typeof value !== 'boolean' && !BOOL_VALUES.has(String(value).toLowerCase())) {
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

function collectErrors(schema, body, fieldFilter) {
  const errors = {};

  for (const [field, rule] of Object.entries(schema)) {
    if (fieldFilter && !fieldFilter.includes(field)) continue;

    const value = body[field];

    if (rule.required && isEmpty(value)) {
      errors[field] = `${field} is required`;
      continue;
    }

    if (!rule.required && isEmpty(value)) continue;

    const error = validateType(field, value, rule);
    if (error) errors[field] = error;
  }

  return errors;
}

function respondErrors(res, errors) {
  if (Object.keys(errors).length === 0) return false;

  res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: Object.entries(errors).map(([field, message]) => ({ field, message })),
  });
  return true;
}

export const validateSchema = (entity) => {
  return (req, res, next) => {
    const schema = resolveSchema(entity);
    if (!schema) return next();

    const errors = collectErrors(schema, req.body);
    if (respondErrors(res, errors)) return;

    next();
  };
};

export const validateFields = (entity, fields) => {
  return (req, res, next) => {
    const schema = resolveSchema(entity);
    if (!schema) return next();

    const fieldFilter = Array.isArray(fields) ? fields : [fields];
    const errors = collectErrors(schema, req.body, fieldFilter);
    if (respondErrors(res, errors)) return;

    next();
  };
};

function buildFieldDoc(rule) {
  const doc = {
    type: rule.type,
    required: rule.required || false,
    description: rule.description || '',
  };

  const constraints = {};
  if (rule.min !== undefined) constraints.min = rule.min;
  if (rule.max !== undefined) constraints.max = rule.max;
  if (rule.minLength) constraints.minLength = rule.minLength;
  if (rule.maxLength) constraints.maxLength = rule.maxLength;
  if (rule.enum) constraints.enum = rule.enum;
  if (rule.unique) constraints.unique = true;
  if (rule.foreignKey) constraints.foreignKey = rule.foreignKey;

  if (Object.keys(constraints).length > 0) {
    doc.constraints = constraints;
  }

  return doc;
}

export const getSchemaDoc = (req, res) => {
  const { entity } = req.params;
  const schema = resolveSchema(entity);

  if (!schema) {
    return res.status(404).json({
      success: false,
      message: `Schema not found for entity: ${entity}`,
    });
  }

  const fields = {};
  for (const [field, rule] of Object.entries(schema)) {
    fields[field] = buildFieldDoc(rule);
  }

  res.json({
    success: true,
    data: { entity, fields },
  });
};

export const getAllSchemas = (req, res) => {
  const allSchemas = {};

  for (const [entity, schema] of Object.entries(schemas)) {
    const fields = {};
    for (const [field, rule] of Object.entries(schema)) {
      fields[field] = {
        type: rule.type,
        required: rule.required || false,
        description: rule.description || '',
      };
    }
    allSchemas[entity] = { entity, fields };
  }

  res.json({
    success: true,
    data: allSchemas,
  });
};
