import type { AnyRecord, Identifier } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';
import BaseRepository from '@shared/repositories/base.repository';
import {
  convertValue as convertValueBySchema,
  isEmpty as isEmptyBySchema,
  normalizeImportRecord,
  transformBySchema as transformBySchemaBySchema,
  validateFieldConstraints as validateFieldConstraintsBySchema,
  validateType as validateTypeBySchema,
} from '@utils/schema-utils';

type SchemaValidationOptions = {
  excludeId?: Identifier;
  includeCustomValidation?: boolean;
  isUpdate?: boolean;
};

type ValidationIssue = {
  field: string;
  message: string;
};

class EntitySchemaService {
  private readonly schemaResolver: () => SchemaDefinition | null;
  private readonly repository: BaseRepository;

  constructor(schemaResolver: () => SchemaDefinition | null, repository: BaseRepository) {
    this.schemaResolver = schemaResolver;
    this.repository = repository;
  }

  getSchema() {
    return this.schemaResolver();
  }

  getSchemaFields() {
    const schema = this.getSchema();
    return schema ? Object.keys(schema) : [];
  }

  getRequiredFields() {
    const schema = this.getSchema();
    if (!schema) return [];

    return Object.entries(schema)
      .filter(([_, rule]) => rule.required)
      .map(([field]) => field);
  }

  validateType(field: string, value: any, rule: SchemaRule) {
    return validateTypeBySchema(field, value, rule);
  }

  convertValue(field: string, value: any, rule: SchemaRule) {
    return convertValueBySchema(field, value, rule);
  }

  transformBySchema(data: AnyRecord) {
    return transformBySchemaBySchema(this.getSchema(), data);
  }

  validateFieldConstraints(field: string, value: any, rule: SchemaRule) {
    return validateFieldConstraintsBySchema(field, value, rule);
  }

  async validateBySchema(data: AnyRecord, options: SchemaValidationOptions = {}) {
    const issues = await this.collectValidationIssues(data, { ...options, includeCustomValidation: true });
    if (issues.length === 0) return { success: true };

    const errors: AnyRecord = {};
    for (const issue of issues) {
      errors[issue.field] = issue.message;
    }

    return { success: false, errors };
  }

  async validateImportData(data: AnyRecord) {
    // Normalize first: trim strings, lowercase booleans/enums, strip hidden fields, etc.
    const schema = this.getSchema();
    const normalized = normalizeImportRecord(schema, data);

    // 1. Remove hidden fields from the live data object
    //    (Object.assign won't delete keys, so we do it explicitly)
    if (schema) {
      for (const [field, rule] of Object.entries(schema)) {
        if (rule.hidden) {
          delete data[field];
        }
      }
    }

    // 2. Merge normalized (non-hidden) values back into data for downstream use
    Object.assign(data, normalized);

    const issues = await this.collectValidationIssues(normalized, { includeCustomValidation: false });
    return issues.map((issue) => issue.message);
  }

  async enrichRelationFields(items: AnyRecord[]) {
    const schema = this.getSchema();
    if (!schema || items.length === 0) return items;

    return Promise.all(
      items.map(async (item) => {
        const enriched = { ...item };

        for (const [field, rule] of Object.entries(schema)) {
          if (!rule.foreignKey || !item[field]) continue;

          const related = await new BaseRepository(rule.foreignKey).findById(item[field]);
          if (related) {
            enriched[`${field}_name`] = related.name || related.email || related.code;
          }
        }

        return enriched;
      }),
    );
  }

  private async collectValidationIssues(data: AnyRecord, options: SchemaValidationOptions) {
    const schema = this.getSchema();
    if (!schema) return [];

    const issues: ValidationIssue[] = [];

    for (const [field, rule] of Object.entries(schema)) {
      // Skip hidden fields — they are never present in import files
      if (rule.hidden) continue;

      const message = await this.validateField(field, data[field], rule, data, options);
      if (message) {
        issues.push({ field, message });
      }
    }

    return issues;
  }

  private async validateField(
    field: string,
    value: any,
    rule: SchemaRule,
    data: AnyRecord,
    options: SchemaValidationOptions,
  ) {
    if (options.isUpdate && value === undefined) return null;

    const label = rule.label || field;

    if (rule.required && isEmptyBySchema(value)) {
      return `${label} là bắt buộc`;
    }

    if (!rule.required && (value === undefined || value === null)) {
      return null;
    }

    const typeError = this.validateType(field, value, rule);
    if (typeError) return typeError;

    const constraintError = this.validateFieldConstraints(field, value, rule);
    if (constraintError) return constraintError;

    if (rule.unique) {
      const query: AnyRecord = { [field]: value };
      if (options.excludeId !== undefined) {
        query.id = { $ne: Number(options.excludeId) };
      }

      const existing = await this.repository.findOne(query);
      if (existing) {
        return `${label} '${value}' đã tồn tại`;
      }
    }

    if (rule.foreignKey) {
      const relatedEntity = await new BaseRepository(rule.foreignKey).findById(value);
      if (!relatedEntity) {
        return `${label} tham chiếu đến dữ liệu không tồn tại (ID: ${value})`;
      }
    }

    if (options.includeCustomValidation !== false && rule.custom && typeof rule.custom === 'function') {
      try {
        const customError = await rule.custom(value, data);
        if (customError) return customError;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return `Kiểm tra dữ liệu thất bại: ${message}`;
      }
    }

    return null;
  }
}

export default EntitySchemaService;
