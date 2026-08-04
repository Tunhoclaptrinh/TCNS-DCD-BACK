import schemas from '@schemas';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { QueryOptions } from '@app-types/database';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';
import type { ServiceResult } from '@app-types/service';
import EntitySchemaService from '@shared/common/entity-schema.service';
import BaseRepository from '@shared/repositories/base.repository';

class BaseService {
  protected readonly collection: string;
  protected readonly repository: BaseRepository;
  private readonly schemaService: EntitySchemaService;

  constructor(collectionName: string, repository: BaseRepository = new BaseRepository(collectionName)) {
    this.collection = collectionName;
    this.repository = repository;
    this.schemaService = new EntitySchemaService(() => this.getSchema(), repository);
  }

  // ==================== SCHEMA METHODS ====================

  getSchema() {
    return schemas[this.collection] || null;
  }

  getSchemaFields() {
    return this.schemaService.getSchemaFields();
  }

  getRequiredFields() {
    return this.schemaService.getRequiredFields();
  }

  validateType(field: string, value: any, rule: SchemaRule) {
    return this.schemaService.validateType(field, value, rule);
  }

  convertValue(field: string, value: any, rule: SchemaRule) {
    return this.schemaService.convertValue(field, value, rule);
  }

  transformBySchema(data: AnyRecord) {
    return this.schemaService.transformBySchema(data);
  }

  validateFieldConstraints(field: string, value: any, rule: SchemaRule) {
    return this.schemaService.validateFieldConstraints(field, value, rule);
  }

  async validateBySchema(data: AnyRecord, options: AnyRecord = {}) {
    return this.schemaService.validateBySchema(data, options);
  }

  async count(query: AnyRecord = {}) {
    return await this.repository.count(query);
  }

  // ==================== CRUD METHODS ====================

  async findAll(options: QueryOptions = {}): Promise<ServiceResult<any[]>> {
    const result = await this.repository.findAllAdvanced(options);
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  async findById(id: Identifier): Promise<ServiceResult> {
    const item = await this.repository.findById(id);
    if (!item) {
      return {
        success: false,
        message: `${this.getModelName()} not found`,
        statusCode: 404,
      };
    }
    return { success: true, data: item };
  }

  async findOne(query: AnyRecord): Promise<ServiceResult> {
    const item = await this.repository.findOne(query);
    return { success: !!item, data: item };
  }

  async findMany(query: AnyRecord): Promise<ServiceResult<any[]>> {
    const items = await this.repository.findMany(query);
    return { success: true, data: items };
  }

  async create(data: AnyRecord): Promise<ServiceResult> {
    const schemaValidation = await this.validateBySchema(data);
    if (!schemaValidation.success) {
      return { success: false, message: 'Validation failed', statusCode: 400, errors: schemaValidation.errors };
    }

    const customValidation = await this.validateCreate(data);
    if (!customValidation.success) return customValidation;

    const transformedData = await this.beforeCreate(data);
    const item = await this.repository.create(transformedData);
    await this.afterCreate(item);

    return {
      success: true,
      message: `${this.getModelName()} created successfully`,
      data: item,
    };
  }

  async update(id: Identifier, data: AnyRecord): Promise<ServiceResult> {
    const existCheck = await this.findById(id);
    if (!existCheck.success) return existCheck;

    const schemaValidation = await this.validateBySchema(data, { excludeId: id, isUpdate: true });
    if (!schemaValidation.success) {
      return { success: false, message: 'Validation failed', statusCode: 400, errors: schemaValidation.errors };
    }

    const customValidation = await this.validateUpdate(id, data);
    if (!customValidation.success) return customValidation;

    const transformedData = await this.beforeUpdate(id, data);
    const updated = await this.repository.update(id, transformedData);
    await this.afterUpdate(updated);

    return {
      success: true,
      message: `${this.getModelName()} updated successfully`,
      data: updated,
    };
  }

  async patch(id: Identifier, data: AnyRecord): Promise<ServiceResult> {
    const existCheck = await this.findById(id);
    if (!existCheck.success) return existCheck;

    // For patch, we merge with existing data before validation if we want strict schema check
    // Or we can perform partial validation. Here we follow a simple merge & update approach
    const customValidation = await this.validateUpdate(id, data);
    if (!customValidation.success) return customValidation;

    const transformedData = await this.beforeUpdate(id, data);
    const updated = await this.repository.update(id, transformedData);
    await this.afterUpdate(updated);

    return {
      success: true,
      message: `${this.getModelName()} patched successfully`,
      data: updated,
    };
  }

  async delete(id: Identifier): Promise<ServiceResult> {
    const existCheck = await this.findById(id);
    if (!existCheck.success) return existCheck;

    const customValidation = await this.validateDelete(id);
    if (!customValidation.success) return customValidation;

    await this.beforeDelete(id);
    await this.repository.delete(id);
    await this.afterDelete(id);

    return {
      success: true,
      message: `${this.getModelName()} deleted successfully`,
    };
  }

  async search(query: string, options: QueryOptions = {}): Promise<ServiceResult<any[]>> {
    const result = await this.repository.findAllAdvanced({ q: query, ...options });
    return {
      success: true,
      data: result.data,
      pagination: result.pagination,
    };
  }

  // ==================== BATCH METHODS ====================

  async bulkCreate(items: AnyRecord[] = []) {
    const results: AnyRecord = { total: items.length, success: 0, failed: 0, errors: [], inserted: [] };

    for (const item of items) {
      try {
        const res = await this.create(item);
        if (res.success) {
          results.success++;
          results.inserted.push(res.data);
        } else {
          results.failed++;
          results.errors.push({ data: item, errors: res.errors || [res.message] });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ data: item, errors: [error.message] });
      }
    }

    return results;
  }

  async bulkUpdate(updates: AnyRecord[] = []) {
    const results: AnyRecord = { total: updates.length, success: 0, failed: 0, errors: [], updated: [] };

    for (const update of updates) {
      try {
        const id = update.id;
        const data = update.data;
        if (!id) throw new Error('ID is required for each update item');

        const res = await this.update(id, data);
        if (res.success) {
          results.success++;
          results.updated.push(res.data);
        } else {
          results.failed++;
          results.errors.push({ id, data, errors: res.errors || [res.message] });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ id: update.id, data: update.data, errors: [error.message] });
      }
    }

    return results;
  }

  async bulkDelete(ids: Identifier[] = []) {
    const results: AnyRecord = { total: ids.length, success: 0, failed: 0, errors: [] };

    for (const id of ids) {
      try {
        const res = await this.delete(id);
        if (res.success) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push({ id, errors: [res.message] });
        }
      } catch (error) {
        results.failed++;
        results.errors.push({ id, errors: [error.message] });
      }
    }

    return results;
  }

  async validateImportData(data: AnyRecord, _rowIndex?: number) {
    await this.preprocessImportRecord(data);
    return this.schemaService.validateImportData(data);
  }

  /**
   * Pre-process import record before schema validation runs.
   * Override in subclass for module-specific foreign key lookups or data normalization.
   */
  async preprocessImportRecord(_data: AnyRecord) {}

  async transformImportData(data: AnyRecord) {
    if (!this.getSchema()) return data;

    const transformed: AnyRecord = this.transformBySchema(data);

    return transformed;
  }

  async importData(records: AnyRecord[]) {
    const results: AnyRecord = { total: records.length, success: 0, failed: 0, errors: [], inserted: [] };

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
          results.errors.push({
            row: rowIndex,
            data: record,
            errors: ['message' in validation ? validation.message : 'Validation failed'],
          });
          continue;
        }

        const item = await this.repository.create(transformed);
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

  async prepareExportData(options: QueryOptions = {}) {
    const result = await this.findAll(options);
    let data = result.data || [];

    if (options.includeRelations && this.getSchema()) {
      data = await this.schemaService.enrichRelationFields(data);
    }

    if (options.columns && Array.isArray(options.columns)) {
      data = data.map((item) => {
        const selected: AnyRecord = {};
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

  async validateCreate(..._args: any[]) {
    return { success: true };
  }

  async validateUpdate(..._args: any[]) {
    return { success: true };
  }

  async validateDelete(..._args: any[]) {
    return { success: true };
  }

  async beforeCreate(data: AnyRecord) {
    const transformed = this.transformBySchema(data);
    return {
      ...transformed,
    };
  }

  async beforeUpdate(_id: Identifier, data: AnyRecord) {
    const transformed = this.transformBySchema(data);
    return {
      ...transformed,
    };
  }

  async beforeDelete(..._args: any[]) {}
  async afterCreate(..._args: any[]) {}
  async afterUpdate(..._args: any[]) {}
  async afterDelete(..._args: any[]) {}

  // ==================== HELPERS ====================

  getModelName() {
    return this.collection.slice(0, -1);
  }

  generateMockData(field: string, rules: any): any {
    if (rules.type === 'string') return 'Dữ liệu mẫu';
    if (rules.type === 'number') return rules.min || 1;
    if (rules.type === 'date') return '01/01/2000';
    if (rules.type === 'boolean') return 'Có';
    if (rules.type === 'enum' && rules.enum && rules.enum.length > 0) return rules.enum[0];
    return '';
  }
}

export default BaseService;
