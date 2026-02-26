import XLSX from 'xlsx';
import { Parser } from 'json2csv';
import userService from '@services/user.service';

const SERVICE_MAP = {
  users: userService,
};

const INSTRUCTION_KEYWORDS = ['required', 'string', 'number', 'boolean', 'FK:', 'min:', 'max:', 'values:'];
const INSTRUCTION_THRESHOLD = 0.3;

class ImportExportService {
  constructor() {
    this.BATCH_SIZE = 100;
  }

  getServiceForEntity(entityName) {
    const service = SERVICE_MAP[entityName];
    if (!service) throw new Error(`Service not found for entity: ${entityName}`);
    return service;
  }

  parseFile(fileBuffer, filename) {
    const extension = filename.split('.').pop().toLowerCase();

    if (!['csv', 'xlsx', 'xls'].includes(extension)) {
      throw new Error('Unsupported file format. Use .xlsx, .xls, or .csv');
    }

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    return XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
  }

  cleanImportData(data) {
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

  async importData(entityName, fileBuffer, filename) {
    const service = this.getServiceForEntity(entityName);

    let rawData = this.parseFile(fileBuffer, filename);
    rawData = this.cleanImportData(rawData);

    if (!rawData || rawData.length === 0) {
      return { success: false, message: 'File is empty or invalid' };
    }

    const schema = service.getSchema();
    const fileHeaders = Object.keys(rawData[0]);
    const missingHeaders = Object.keys(schema)
      .filter((key) => schema[key].required)
      .filter((h) => !fileHeaders.includes(h));

    if (missingHeaders.length > 0) {
      return {
        success: false,
        message: `Missing required columns: ${missingHeaders.join(', ')}`,
      };
    }

    return await service.importData(rawData);
  }

  async exportData(entityName, format = 'xlsx', options = {}) {
    const service = this.getServiceForEntity(entityName);
    const data = await service.prepareExportData(options);

    if (!Array.isArray(data) || data.length === 0) {
      return this.generateEmptyFile(format);
    }

    return format === 'csv' ? this.generateCSV(data) : this.generateExcel(data, entityName);
  }

  generateTemplate(entityName, format = 'xlsx') {
    const service = this.getServiceForEntity(entityName);
    const schema = service.getSchema();

    const headers = {};
    const instructions = {};

    for (const [field, rules] of Object.entries(schema)) {
      headers[field] = '';

      const parts = [rules.type];
      if (rules.required) parts.push('required');
      if (rules.foreignKey) parts.push(`FK: ${rules.foreignKey}`);
      if (rules.min !== undefined) parts.push(`min: ${rules.min}`);
      if (rules.max !== undefined) parts.push(`max: ${rules.max}`);
      if (rules.values) parts.push(`values: ${rules.values.join('|')}`);

      instructions[field] = parts.join(', ');
    }

    const data = [instructions, headers];
    return format === 'csv' ? this.generateCSV(data) : this.generateExcel(data, `${entityName}_template`);
  }

  getEntitySchema(entityName) {
    try {
      return this.getServiceForEntity(entityName).getSchema();
    } catch {
      return null;
    }
  }

  generateExcel(data, sheetName = 'Sheet1') {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  generateCSV(data) {
    if (data.length === 0) return Buffer.from('');
    return Buffer.from(new Parser().parse(data));
  }

  generateEmptyFile(format) {
    if (format === 'csv') {
      return Buffer.from('No data available');
    }
    return this.generateExcel([{ message: 'No data available' }]);
  }
}

export default new ImportExportService();
