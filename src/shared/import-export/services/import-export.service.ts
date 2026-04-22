import XLSX from 'xlsx';
import { Parser } from 'json2csv';
import userService from '@modules/users/services/user.service';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

const SERVICE_MAP = {
  users: userService,
};

const INSTRUCTION_KEYWORDS = ['required', 'string', 'number', 'boolean', 'FK:', 'min:', 'max:', 'values:'];
const INSTRUCTION_THRESHOLD = 0.3;

class ImportExportService {
  BATCH_SIZE: number;

  constructor() {
    this.BATCH_SIZE = 100;
  }

  getServiceForEntity(entityName: string) {
    const service = SERVICE_MAP[entityName];
    if (!service) throw ApiError.notFound(`Service not found for entity: ${entityName}`);
    return service;
  }

  /**
   * Parse file and map headers back to technical keys if labels were used
   */
  parseFile(fileBuffer: Buffer, filename: string, schema?: SchemaDefinition) {
    const extension = filename.split('.').pop().toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      throw ApiError.badRequest('Unsupported file format. Use .xlsx, .xls, or .csv');
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]) as AnyRecord[];

    if (schema && jsonData.length > 0) {
      return this.mapLabelsToKeys(jsonData, schema);
    }

    return jsonData;
  }

  /**
   * Helper to map human-readable labels from Excel back to technical JSON keys
   */
  private mapLabelsToKeys(data: AnyRecord[], schema: SchemaDefinition) {
    // Create label -> key map
    const labelToKey: Record<string, string> = {};
    Object.entries(schema).forEach(([key, rule]) => {
      if (rule.label) {
        labelToKey[rule.label] = key;
      }
      // Also keep the original key mapping in case user used technical names
      labelToKey[key] = key;
    });

    return data.map((row) => {
      const mappedRow: AnyRecord = {};
      Object.entries(row).forEach(([header, value]) => {
        const key = labelToKey[header.trim()] || header;
        mappedRow[key] = value;
      });
      return mappedRow;
    });
  }

  cleanImportData(data: AnyRecord[]) {
    if (!Array.isArray(data)) return [];

    return data.filter((row) => {
      const values = Object.values(row);

      const isEmptyRow = values.every((val) => val === null || val === undefined || String(val).trim() === '');
      if (isEmptyRow) return false;

      let matchCount = 0;
      for (const val of values) {
        if (typeof val === 'string' && INSTRUCTION_KEYWORDS.some((kw) => val.includes(kw))) {
          matchCount++;
        }
      }

      const isInstructionRow =
        matchCount >= 2 || (values.length > 0 && matchCount / values.length > INSTRUCTION_THRESHOLD);
      return !isInstructionRow;
    });
  }

  async importData(entityName: string, fileBuffer: Buffer, filename: string) {
    const service = this.getServiceForEntity(entityName);
    const schema = service.getSchema() as SchemaDefinition;

    let rawData = this.parseFile(fileBuffer, filename, schema);
    rawData = this.cleanImportData(rawData);

    if (!rawData || rawData.length === 0) {
      throw ApiError.badRequest('File is empty or invalid');
    }

    const fileHeaders = Object.keys(rawData[0]);
    const missingHeaders = Object.keys(schema)
      .filter((key) => schema[key].required && !schema[key].hidden)
      .filter((h) => !fileHeaders.includes(h));

    if (missingHeaders.length > 0) {
      const missingLabels = missingHeaders.map((h) => schema[h].label || h);
      throw ApiError.badRequest(`Missing required columns: ${missingLabels.join(', ')}`);
    }

    return await service.importData(rawData);
  }

  /**
   * Validate import file without saving data
   */
  async validateImportFile(entityName: string, fileBuffer: Buffer, filename: string) {
    const service = this.getServiceForEntity(entityName);
    const schema = service.getSchema() as SchemaDefinition;

    let rawData = this.parseFile(fileBuffer, filename, schema);
    rawData = this.cleanImportData(rawData);

    if (!rawData || rawData.length === 0) {
      throw ApiError.badRequest('File is empty or invalid');
    }

    const results = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const record = rawData[i];
      const rowIndex = i + 2; // Assuming header is row 1

      try {
        // 1. Basic Schema Validation (types, required, etc)
        const schemaErrors = await service.validateImportData(record, rowIndex);

        // 2. Custom Business Logic (unique constraints, etc)
        // We need to transform the data first to check things like hashed passwords or generated fields correctly if needed
        // But usually unique constraints (email) happen on the raw-ish data
        const transformed = await service.transformImportData(record);
        const bizValidation = await service.validateCreate(transformed);

        const allErrors = [...schemaErrors];
        if (!bizValidation.success) {
          allErrors.push(bizValidation.message || 'Business validation failed');
        }

        if (allErrors.length === 0) {
          validCount++;
          results.push({
            row: rowIndex,
            data: record,
            status: 'valid',
            errors: [],
          });
        } else {
          errorCount++;
          results.push({
            row: rowIndex,
            data: record,
            status: 'invalid',
            errors: allErrors,
          });
        }
      } catch (error) {
        errorCount++;
        results.push({
          row: rowIndex,
          data: record,
          status: 'invalid',
          errors: [error.message || 'Unknown validation error'],
        });
      }
    }

    return {
      summary: {
        total: rawData.length,
        valid: validCount,
        error: errorCount,
      },
      results,
    };
  }

  async exportData(entityName: string, format = 'xlsx', options: AnyRecord = {}) {
    const service = this.getServiceForEntity(entityName);
    const schema = service.getSchema();
    const rawData = await service.prepareExportData(options);

    if (!Array.isArray(rawData) || rawData.length === 0) {
      return this.generateEmptyFile(format);
    }

    // Map data to use labels as headers
    const columns = options.columns ? (options.columns as string[]) : Object.keys(schema);
    const mappedData = rawData.map((row) => {
      const mappedRow: AnyRecord = {};
      columns.forEach((key) => {
        const rule = schema[key];
        if (rule && !rule.hidden) {
          const label = rule.label || key;
          mappedRow[label] = row[key];
        }
      });
      return mappedRow;
    });

    return format === 'csv' ? this.generateCSV(mappedData) : this.generateExcel(mappedData, entityName);
  }

  generateTemplate(entityName: string, format = 'xlsx', selectedColumns?: string[]) {
    const service = this.getServiceForEntity(entityName);
    const schema = service.getSchema();

    const templateData: AnyRecord = {};
    const instructions: AnyRecord = {};

    const columnsToInclude = selectedColumns || Object.keys(schema).filter((k) => !schema[k].hidden);

    columnsToInclude.forEach((field) => {
      const rules = schema[field];
      if (!rules) return;

      const label = rules.label || field;
      templateData[label] = '';

      const parts: string[] = [String(rules.type)];
      if (rules.required) parts.push('required');
      if (rules.foreignKey) parts.push(`FK: ${rules.foreignKey}`);
      if (rules.min !== undefined) parts.push(`min: ${rules.min}`);
      if (rules.max !== undefined) parts.push(`max: ${rules.max}`);
      if (rules.values) parts.push(`values: ${rules.values.join('|')}`);

      instructions[label] = parts.join(', ');
    });

    const data = [instructions, templateData];
    return format === 'csv' ? this.generateCSV(data) : this.generateExcel(data, `${entityName}_template`);
  }

  getEntitySchema(entityName: string) {
    try {
      return this.getServiceForEntity(entityName).getSchema();
    } catch {
      return null;
    }
  }

  generateExcel(data: AnyRecord[], sheetName = 'Sheet1') {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  generateCSV(data: AnyRecord[]) {
    if (data.length === 0) return Buffer.from('');
    return Buffer.from(new Parser().parse(data));
  }

  generateEmptyFile(format: string) {
    if (format === 'csv') {
      return Buffer.from('No data available');
    }
    return this.generateExcel([{ message: 'No data available' }]);
  }
}

export default new ImportExportService();
