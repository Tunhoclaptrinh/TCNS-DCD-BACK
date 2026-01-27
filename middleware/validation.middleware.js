const { body } = require('express-validator');
const schemas = require('../schemas');

/**
 * Generate express-validator chains from schema
 */
exports.validateSchema = (schemaName) => {
  const schema = schemas[schemaName];
  if (!schema) return [];

  const validations = [];

  for (const [field, rule] of Object.entries(schema)) {
    let chain = body(field);

    if (rule.required) {
      chain = chain.notEmpty().withMessage(`${field} is required`);
    } else {
      chain = chain.optional();
    }

    if (rule.type === 'email') {
      chain = chain.isEmail().withMessage('Invalid email');
    }

    if (rule.minLength) {
      chain = chain.isLength({ min: rule.minLength }).withMessage(`${field} min length is ${rule.minLength}`);
    }

    validations.push(chain);
  }

  return validations;
};

exports.validateFields = (schemaName, fields) => {
    // Simplified: Just reuse validateSchema logic but filter keys? 
    // Or just manual for now. 
    // For Base, let's keep it simple.
    
    // Actually, let's just use manual validation in routes for specific fields if schema is too complex
    // Or just return keys.
    const schema = schemas[schemaName];
    if (!schema) return [];
    
    const validations = [];
    fields.forEach(field => {
        const rule = schema[field];
        if (rule) {
             let chain = body(field);
             if (rule.required) chain = chain.notEmpty().withMessage(`${field} is required`);
             if (rule.type === 'email') chain = chain.isEmail().withMessage('Invalid email');
             validations.push(chain);
        }
    });
    return validations;
};
