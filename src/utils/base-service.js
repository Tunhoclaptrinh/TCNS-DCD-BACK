import db from '@config/database';
import schemas from '@schemas';

const BOOL_VALUES = new Set(['true', 'false', '1', '0']);
const BOOL_TRUTHY = new Set(['true', '1', 'yes']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isEmpty(value) {
  return value === undefined || value === null || value === '';
}

class BaseService {
  constructor(collectionName) {
    this.collection = collectionName;
    this.schema = schemas[collectionName] || null;
  }

  // ==================== SCHEMA METHODS ====================

  getSchema() {
    return this.schema;
  }

  getSchemaFields() {
    if (!this.schema) return [];
    return Object.keys(this.schema);
  }

  getRequiredFields() {
    if (!this.schema) return [];
    return Object.entries(this.schema)
      .filter(([_, rule]) => rule.required)
      .map(([field]) => field);
  }

  validateType(field, value, rule) {
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

  convertValue(field, value, rule) {
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

  transformBySchema(data) {
    if (!this.schema) return data;

    const transformed = {};
    for (const [field, rule] of Object.entries(this.schema)) {
      if (field in data) {
        transformed[field] = this.convertValue(field, data[field], rule);
      }
    }
    return transformed;
  }

  validateFieldConstraints(field, value, rule) {
    if (rule.min !== undefined && Number(value) < rule.min) return `${field} must be >= ${rule.min}`;
    if (rule.max !== undefined && Number(value) > rule.max) return `${field} must be <= ${rule.max}`;
    if (rule.minLength && value.length < rule.minLength)
      return `${field} must be at least ${rule.minLength} characters`;
    if (rule.maxLength && value.length > rule.maxLength) return `${field} must be at most ${rule.maxLength} characters`;
    if (rule.enum && !rule.enum.includes(value)) return `${field} must be one of: ${rule.enum.join(', ')}`;
    return null;
  }

  async validateBySchema(data, options = {}) {
    if (!this.schema) return { success: true };

    const errors = {};

    for (const [field, rule] of Object.entries(this.schema)) {
      const value = data[field];

      if (options.isUpdate && value === undefined) continue;

      if (rule.required && isEmpty(value)) {
        errors[field] = `${field} is required`;
        continue;
      }

      if (!rule.required && (value === undefined || value === null)) continue;

      const typeError = this.validateType(field, value, rule);
      if (typeError) {
        errors[field] = typeError;
        continue;
      }

      const constraintError = this.validateFieldConstraints(field, value, rule);
      if (constraintError) {
        errors[field] = constraintError;
        continue;
      }

      if (rule.unique) {
        const query = { [field]: value };
        if (options.excludeId) {
          query.id = { $ne: Number(options.excludeId) };
        }
        const existing = await db.findOne(this.collection, query);
        if (existing) {
          errors[field] = `${field} '${value}' already exists`;
        }
      }

      if (rule.foreignKey) {
        const relatedEntity = await db.findById(rule.foreignKey, value);
        if (!relatedEntity) {
          errors[field] = `${field} references non-existent ${rule.foreignKey} (ID: ${value})`;
        }
      }

      if (rule.custom && typeof rule.custom === 'function') {
        try {
          const customError = await rule.custom(value, data);
          if (customError) errors[field] = customError;
        } catch (err) {
          errors[field] = `Custom validation failed: ${err.message}`;
        }
      }
    }

    return Object.keys(errors).length === 0 ? { success: true } : { success: false, errors };
  }

  // ==================== CRUD METHODS ====================

  async findAll(options = {}) {
    const result = await db.findAllAdvanced(this.collection, options);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  async findById(id) {
    const item = await db.findById(this.collection, id);
    if (!item) {
      return {
        success: false,
        message: `${this.getModelName()} not found`,
        statusCode: 404,
      };
    }
    return { success: true, data: item };
  }

  async findOne(query) {
    const item = await db.findOne(this.collection, query);
    return { success: !!item, data: item };
  }

  async findMany(query) {
    const items = await db.findMany(this.collection, query);
    return { success: true, data: items };
  }

  async create(data) {
    const schemaValidation = await this.validateBySchema(data);
    if (!schemaValidation.success) {
      return { success: false, message: 'Validation failed', statusCode: 400, errors: schemaValidation.errors };
    }

    const customValidation = await this.validateCreate(data);
    if (!customValidation.success) return customValidation;

    const transformedData = await this.beforeCreate(data);
    const item = await db.create(this.collection, transformedData);
    await this.afterCreate(item);

    return {
      success: true,
      message: `${this.getModelName()} created successfully`,
      data: item,
    };
  }

  async update(id, data) {
    const existCheck = await this.findById(id);
    if (!existCheck.success) return existCheck;

    const schemaValidation = await this.validateBySchema(data, { excludeId: id, isUpdate: true });
    if (!schemaValidation.success) {
      return { success: false, message: 'Validation failed', statusCode: 400, errors: schemaValidation.errors };
    }

    const customValidation = await this.validateUpdate(id, data);
    if (!customValidation.success) return customValidation;

    const transformedData = await this.beforeUpdate(id, data);
    const updated = await db.update(this.collection, id, transformedData);
    await this.afterUpdate(updated);

    return {
      success: true,
      message: `${this.getModelName()} updated successfully`,
      data: updated,
    };
  }

  async delete(id) {
    const existCheck = await this.findById(id);
    if (!existCheck.success) return existCheck;

    const customValidation = await this.validateDelete(id);
    if (!customValidation.success) return customValidation;

    await this.beforeDelete(id);
    await db.delete(this.collection, id);
    await this.afterDelete(id);

    return {
      success: true,
      message: `${this.getModelName()} deleted successfully`,
    };
  }

  async search(query, options = {}) {
    const result = await db.findAllAdvanced(this.collection, { q: query, ...options });
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  // ==================== IMPORT/EXPORT ====================

  async validateImportData(data) {
    if (!this.schema) return [];

    const errors = [];

    for (const [field, rule] of Object.entries(this.schema)) {
      const value = data[field];

      if (rule.required && isEmpty(value)) {
        errors.push(`${field} is required`);
        continue;
      }

      if (!rule.required && (value === undefined || value === null)) continue;

      const typeError = this.validateType(field, value, rule);
      if (typeError) {
        errors.push(typeError);
        continue;
      }

      const constraintError = this.validateFieldConstraints(field, value, rule);
      if (constraintError) {
        errors.push(constraintError);
        continue;
      }

      if (rule.foreignKey) {
        const relatedEntity = await db.findById(rule.foreignKey, value);
        if (!relatedEntity) {
          errors.push(`${field} references non-existent ${rule.foreignKey} (ID: ${value})`);
        }
      }

      if (rule.unique) {
        const existing = await db.findOne(this.collection, { [field]: value });
        if (existing) {
          errors.push(`${field} '${value}' already exists`);
        }
      }
    }

    return errors;
  }

  async transformImportData(data) {
    if (!this.schema) return data;

    const transformed = this.transformBySchema(data);
    transformed.createdAt = new Date().toISOString();
    transformed.updatedAt = new Date().toISOString();

    return transformed;
  }

  async importData(records) {
    const results = { total: records.length, success: 0, failed: 0, errors: [], inserted: [] };

    for (let i = 0; i < records.length; i++) {
      const rowIndex = i + 2;
      const record = records[i];

      try {
        const errors = await this.validateImportData(record, rowIndex);
        if (errors.length > 0) {
          results.failed++;
          results.errors.push({ row: rowIndex, data: record, errors });
          continue;
        }

        const transformed = await this.transformImportData(record);
        const validation = await this.validateCreate(transformed);

        if (!validation.success) {
          results.failed++;
          results.errors.push({ row: rowIndex, data: record, errors: [validation.message] });
          continue;
        }

        const item = await db.create(this.collection, transformed);
        results.success++;
        results.inserted.push(item);
      } catch (error) {
        results.failed++;
        results.errors.push({ row: rowIndex, data: record, errors: [error.message] });
      }
    }

    return {
      success: true,
      message: `Import completed: ${results.success} succeeded, ${results.failed} failed`,
      data: results,
    };
  }

  async prepareExportData(options = {}) {
    const result = await this.findAll(options);
    let data = result.data;

    if (options.includeRelations && this.schema) {
      data = await Promise.all(
        data.map(async (item) => {
          const enriched = { ...item };

          for (const [field, rule] of Object.entries(this.schema)) {
            if (rule.foreignKey && item[field]) {
              const related = await db.findById(rule.foreignKey, item[field]);
              if (related) {
                enriched[`${field}_name`] = related.name || related.email || related.code;
              }
            }
          }

          return enriched;
        }),
      );
    }

    if (options.columns && Array.isArray(options.columns)) {
      data = data.map((item) => {
        const selected = {};
        for (const col of options.columns) {
          selected[col] = item[col];
          if (item[`${col}_name`]) {
            selected[`${col}_name`] = item[`${col}_name`];
          }
        }
        return selected;
      });
    }

    return data;
  }

  // ==================== HOOKS (Override in subclass) ====================

  async validateCreate() {
    return { success: true };
  }

  async validateUpdate() {
    return { success: true };
  }

  async validateDelete() {
    return { success: true };
  }

  async beforeCreate(data) {
    const transformed = this.transformBySchema(data);
    return {
      ...transformed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async beforeUpdate(id, data) {
    const transformed = this.transformBySchema(data);
    return {
      ...transformed,
      updatedAt: new Date().toISOString(),
    };
  }

  async beforeDelete() {}
  async afterCreate() {}
  async afterUpdate() {}
  async afterDelete() {}

  // ==================== HELPERS ====================

  getModelName() {
    return this.collection.slice(0, -1);
  }
}

export default BaseService;
