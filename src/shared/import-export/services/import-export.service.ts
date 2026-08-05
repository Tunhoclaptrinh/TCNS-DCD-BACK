import XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { Parser } from 'json2csv';
import userService from '@modules/users/services/user.service';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

const SERVICE_MAP = {
  users: userService,
};

const SYSTEM_READABLE_TEXT_MAP: Record<string, string> = {
  male: 'Nam',
  female: 'Nữ',
  other: 'Khác',
  active: 'Đang hoạt động',
  inactive: 'Đã nghỉ',
  dismissed: 'Khai trừ',
  ctv: 'Cộng tác viên',
  tv: 'Thành viên',
  tvb: 'Thành viên ban',
  pb: 'Phó ban',
  tb: 'Trưởng ban',
  dt: 'Đội trưởng',
  true: 'Có',
  false: 'Không',
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

    const workbook = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {
      raw: false, // parse everything as formatted strings, not raw values
      defval: '', // empty cells become ''
    }) as AnyRecord[];

    if (schema && jsonData.length > 0) {
      return this.mapLabelsToKeys(jsonData, schema);
    }

    return jsonData;
  }

  /**
   * Helper to map human-readable labels from Excel back to technical JSON keys
   */
  private mapLabelsToKeys(data: AnyRecord[], schema: SchemaDefinition) {
    // Dynamically build label -> key mapping purely from Schema Definition
    const labelToKey: Record<string, string> = {};

    Object.entries(schema).forEach(([key, rule]) => {
      // 1. Technical key itself
      labelToKey[key] = key;

      // 2. Base key if it ends with Id or Ids (e.g. generationId -> generation)
      const baseKey = key.replace(/(Ids|Id)$/, '');
      if (baseKey !== key) {
        labelToKey[baseKey] = key;
      }

      // 3. Human readable label defined in Schema
      if (rule.label) {
        labelToKey[rule.label.trim()] = key;
        labelToKey[rule.label.trim().toLowerCase()] = key;
      }
    });

    return data.map((row) => {
      const mappedRow: AnyRecord = {};
      Object.entries(row).forEach(([header, value]) => {
        const trimmedHeader = header.trim();
        const lowerHeader = trimmedHeader.toLowerCase();

        // Match against exact label, technical key, base key, or lowercase label from Schema
        const matchedKey =
          labelToKey[trimmedHeader] ||
          labelToKey[lowerHeader] ||
          Object.keys(schema).find((k) => schema[k].label?.trim().toLowerCase() === lowerHeader) ||
          trimmedHeader;

        mappedRow[matchedKey] = value;
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

    const MAX_IMPORT_ROWS = 200;

    if (!rawData || rawData.length === 0) {
      throw ApiError.badRequest('Tệp dữ liệu rỗng hoặc không hợp lệ');
    }

    if (rawData.length > MAX_IMPORT_ROWS) {
      throw ApiError.badRequest(
        `Tệp dữ liệu vượt quá giới hạn tối đa ${MAX_IMPORT_ROWS} dòng (hiện có ${rawData.length} dòng). Vui lòng chia nhỏ tệp và thử lại.`,
      );
    }

    const fileHeaders = Object.keys(rawData[0]);
    const missingHeaders = Object.keys(schema)
      .filter((key) => schema[key].required && !schema[key].hidden)
      .filter((h) => !fileHeaders.includes(h));

    if (missingHeaders.length > 0) {
      const missingLabels = missingHeaders.map((h) => schema[h].label || h);
      throw ApiError.badRequest(`Thiếu các cột bắt buộc: ${missingLabels.join(', ')}`);
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

    const MAX_IMPORT_ROWS = 200;

    if (!rawData || rawData.length === 0) {
      throw ApiError.badRequest('Tệp dữ liệu rỗng hoặc không hợp lệ');
    }

    if (rawData.length > MAX_IMPORT_ROWS) {
      throw ApiError.badRequest(
        `Tệp dữ liệu vượt quá giới hạn tối đa ${MAX_IMPORT_ROWS} dòng (hiện có ${rawData.length} dòng). Vui lòng chia nhỏ tệp và thử lại.`,
      );
    }

    const results = [];
    let validCount = 0;
    let errorCount = 0;

    for (let i = 0; i < rawData.length; i++) {
      const originalRecord = { ...rawData[i] };
      const record = rawData[i];
      const rowIndex = i + 2; // Assuming header is row 1

      try {
        // 1. Basic Schema Validation (types, required, etc)
        const schemaErrors = await service.validateImportData(record, rowIndex);

        // 2. Compute auto-mapping metadata between original input and normalized/mapped values
        const _mappings: Record<string, { raw: any; mapped: any }> = {};
        for (const [k, origVal] of Object.entries(originalRecord)) {
          if (origVal !== undefined && origVal !== null && String(origVal).trim() !== '') {
            const currentVal = record[k];
            const baseKey = k.replace(/(Ids|Id)$/, '');
            const nameVal =
              record[`${k}_name`] ||
              record[`${baseKey}_name`] ||
              record[`${baseKey}Name`] ||
              record[`${baseKey}_names`] ||
              record[`${baseKey}Names`];
            const displayMapped = nameVal || currentVal;
            const rawStr = String(origVal).trim();
            const mappedStr = String(displayMapped ?? '').trim();

            if (mappedStr !== '' && rawStr !== mappedStr) {
              _mappings[k] = { raw: origVal, mapped: displayMapped };
              _mappings[baseKey] = { raw: origVal, mapped: displayMapped };
            }
          }
        }
        if (Object.keys(_mappings).length > 0) {
          record._mappings = _mappings;
        }

        // 3. Custom Business Logic (unique constraints, etc)
        const transformed = await service.transformImportData(record);
        const bizValidation = await service.validateCreate(transformed);

        const rawErrors = [...schemaErrors];
        if (!bizValidation.success && bizValidation.message) {
          rawErrors.push(bizValidation.message);
        }
        const allErrors = Array.from(new Set(rawErrors));

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

    // Map data to use labels as headers and human-readable names for foreign keys & enums
    const rawColumns = options.columns ? (options.columns as string[]) : Object.keys(schema);
    const keyAliasMap: Record<string, string> = {
      generation: 'generationId',
    };

    const mappedData = rawData.map((row) => {
      const mappedRow: AnyRecord = {};
      rawColumns.forEach((rawColKey) => {
        const key = keyAliasMap[rawColKey] || rawColKey;
        const rule = schema[key];
        // Allow column if explicitly requested in options.columns or if not hidden in schema
        const isRequested = Array.isArray(options.columns) && options.columns.includes(rawColKey);
        if (!rule || isRequested || !rule.hidden) {
          const label = rule?.label || rawColKey;
          const baseKey = key.replace(/(Ids|Id)$/, '');

          const nameVal =
            row[`${key}_name`] ||
            row[`${baseKey}_name`] ||
            row[`${baseKey}Name`] ||
            row[`${baseKey}_names`] ||
            row[`${baseKey}Names`];

          const rawVal = row[key] !== undefined ? row[key] : row[rawColKey];
          const lowerVal = String(rawVal ?? '')
            .trim()
            .toLowerCase();
          const readableVal = SYSTEM_READABLE_TEXT_MAP[lowerVal];

          mappedRow[label] = nameVal || readableVal || (rawVal ?? '');
        }
      });
      return mappedRow;
    });

    return format === 'csv'
      ? this.generateCSV(mappedData)
      : await this.generateExcel(mappedData, entityName, options.columns as string[]);
  }

  async generateTemplate(entityName: string, format = 'xlsx', selectedColumns?: string[], withMockData = true) {
    const service = this.getServiceForEntity(entityName);
    const schema = service.getSchema() as SchemaDefinition;

    const templateData: AnyRecord = {};
    const instructions: AnyRecord = {};

    const columnsToInclude = selectedColumns || Object.keys(schema).filter((k) => !schema[k].hidden);

    for (const field of columnsToInclude) {
      const rules = schema[field];
      if (!rules) continue;

      const label = rules.label || field;

      // Generate Instructions
      const parts: string[] = [];
      if (rules.required) parts.push('Bắt buộc');
      else parts.push('Tùy chọn');

      if (rules.type === 'enum' && rules.enum?.length) {
        parts.push(`Chọn: ${rules.enum.join(' | ')}`);
      } else if (rules.type === 'boolean') {
        parts.push('Chọn: Có | Không');
      } else if (rules.type === 'date') {
        parts.push('Định dạng: DD/MM/YYYY');
      } else if (rules.type === 'email') {
        parts.push('Định dạng: email@example.com');
      } else if (rules.foreignKey) {
        parts.push(`Nhập Tên hoặc ID ${rules.foreignKey}`);
      }

      instructions[label] = parts.join(' - ');

      // Generate Mock Data
      let mockValue: any = '';
      if (typeof (service as any).generateMockData === 'function') {
        mockValue = await (service as any).generateMockData(field, rules);
      }

      templateData[label] = mockValue;
    }

    const data = withMockData ? [templateData] : [instructions, {}];
    return format === 'csv' ? this.generateCSV(data) : await this.generateExcel(data, entityName, selectedColumns);
  }

  getEntitySchema(entityName: string) {
    try {
      return this.getServiceForEntity(entityName).getSchema();
    } catch {
      return null;
    }
  }

  async generateExcel(data: AnyRecord[], entityName = 'Sheet1', selectedColumns?: string[]) {
    const service = this.getServiceForEntity(entityName);
    const schema = (service?.getSchema ? service.getSchema() : {}) as SchemaDefinition;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(entityName);

    if (data.length === 0) {
      const buffer = await workbook.xlsx.writeBuffer();
      return Buffer.from(buffer);
    }

    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF8B1D1D' }, // Primary red theme
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 24;

    // Add Data Rows
    data.forEach((row) => {
      const rowValues = headers.map((h) => row[h] ?? '');
      worksheet.addRow(rowValues);
    });

    // Configure Excel Native Data Validation & Dropdowns for rows 2 to 200
    headers.forEach((header, colIdx) => {
      const colLetter = worksheet.getColumn(colIdx + 1).letter;
      const fieldKey = Object.keys(schema).find((k) => (schema[k]?.label || k) === header) || header;
      const rule = schema[fieldKey];

      let listFormula: string | null = null;
      if (rule?.type === 'enum' && rule.enum?.length) {
        listFormula = `"${rule.enum.join(',')}"`;
      } else if (rule?.type === 'boolean') {
        listFormula = '"Có,Không"';
      } else if (fieldKey === 'gender') {
        listFormula = '"Nam,Nữ,Khác"';
      } else if (fieldKey === 'status') {
        listFormula = '"Đang hoạt động,Đã nghỉ,Khai trừ"';
      } else if (fieldKey === 'position') {
        listFormula = '"Cộng tác viên,Thành viên,Thành viên ban,Phó ban,Trưởng ban,Đội trưởng"';
      }

      if (listFormula) {
        for (let rowIdx = 2; rowIdx <= 200; rowIdx++) {
          const cell = worksheet.getCell(`${colLetter}${rowIdx}`);
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: [listFormula],
            showErrorMessage: true,
            errorTitle: 'Giá trị không hợp lệ',
            error: 'Vui lòng chọn một giá trị hợp lệ từ danh sách thả xuống!',
          };
        }
      }

      // Auto-fit Column Width
      let maxLen = header.length;
      data.forEach((row) => {
        const valStr = String(row[header] ?? '');
        if (valStr.length > maxLen) maxLen = valStr.length;
      });
      worksheet.getColumn(colIdx + 1).width = Math.min(Math.max(maxLen + 6, 16), 45);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
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
