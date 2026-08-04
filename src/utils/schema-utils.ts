import type { AnyRecord } from '@app-types/common';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

// ─── Bool sets (case-insensitive after lowercase) ────────────────────────────
// Includes Vietnamese "Có"/"Không" used in export readable mode
const BOOL_VALID = new Set(['true', 'false', '1', '0', 'yes', 'no', 'có', 'co', 'không', 'khong']);
const BOOL_TRUTHY = new Set(['true', '1', 'yes', 'có', 'co']);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Date parser ─────────────────────────────────────────────────────────────
/**
 * Normalize any date-like value to a JS Date.
 * Handles: JS Date, ISO string, dd/mm/yyyy, dd-mm-yyyy, Excel serial number.
 */
function parseDate(value: any): Date | null {
  if (value === undefined || value === null || value === '') return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const str = String(value).trim();
  if (!str) return null;

  // ISO 8601 or standard parseable (yyyy-mm-dd, mm/dd/yyyy on en-US systems)
  const d = new Date(str);
  if (!isNaN(d.getTime())) return d;

  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy  (Vietnamese convention)
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  // Excel serial number (integer, days since 1899-12-30)
  const serial = Number(str);
  if (!isNaN(serial) && Number.isInteger(serial) && serial > 1 && serial < 2958466) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const parsed = new Date(excelEpoch.getTime() + serial * 86400000);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

// ─── String normalizer ───────────────────────────────────────────────────────
/**
 * Trim whitespace. For import, always treat values as strings first.
 */
function normalizeString(value: any): string {
  return String(value ?? '').trim();
}

// Placeholder values exported as "empty" — treat as null during import
const EMPTY_PLACEHOLDERS = new Set(['—', '-', 'n/a', 'N/A', '', 'null', 'undefined']);

// ─── Enum normalizer ─────────────────────────────────────────────────────────
/**
 * Find a matching enum value case-insensitively.
 * Returns the canonical (schema) enum value if found, or the original if not.
 */
export function normalizeEnum(value: any, enumValues: string[]): string {
  const normalized = normalizeString(value).toLowerCase();
  const match = enumValues.find((e) => e.toLowerCase() === normalized);
  return match ?? String(value); // return canonical or original so schema validation can report the error
}

// ─── Master pre-processor called before any validation ───────────────────────
/**
 * Normalize a raw import record at the schema level:
 * - Trim all string values
 * - Normalize booleans: "True" / "TRUE" / "1" / "yes" → true, etc.
 * - Normalize enums: "Active" → "active" (case-insensitive match)
 * - Normalize numbers: remove surrounding whitespace
 *
 * This runs BEFORE validateType so all comparisons are clean.
 */
export function normalizeImportRecord(schema: SchemaDefinition | null, data: AnyRecord): AnyRecord {
  if (!schema) return data;

  const result: AnyRecord = { ...data };

  for (const [field, rule] of Object.entries(schema)) {
    // Skip fields the schema marks as hidden — they shouldn't be imported
    if (rule.hidden) {
      delete result[field]; // remove from data so validateType never sees them
      continue;
    }

    if (!(field in result)) continue;
    const raw = result[field];

    // Convert export placeholder "—" and similar to null so optional fields pass
    if (typeof raw === 'string' && EMPTY_PLACEHOLDERS.has(raw.trim())) {
      result[field] = null;
      continue; // null handled by required check / default in convertValue
    }

    // Skip truly absent values — defaults handled in convertValue
    if (raw === undefined || raw === null) continue;

    switch (rule.type) {
      case 'string':
      case 'email':
        result[field] = normalizeString(raw);
        break;

      case 'number': {
        const trimmed = normalizeString(raw);
        result[field] = trimmed === '' ? null : trimmed;
        break;
      }

      case 'boolean': {
        if (typeof raw === 'boolean') break; // already correct
        const lower = normalizeString(raw).toLowerCase();
        if (BOOL_VALID.has(lower)) {
          result[field] = BOOL_TRUTHY.has(lower);
        }
        // else leave as-is → validateType will report the error
        break;
      }

      case 'enum': {
        if (raw !== '' && rule.enum?.length) {
          result[field] = normalizeEnum(raw, rule.enum);
        }
        break;
      }

      case 'date':
        // Leave as-is — parseDate handles all formats
        break;
    }
  }

  return result;
}

// ─── isEmpty ─────────────────────────────────────────────────────────────────
export function isEmpty(value: any) {
  return value === undefined || value === null || value === '';
}

// ─── validateType ─────────────────────────────────────────────────────────────
export function validateType(field: string, value: any, rule: SchemaRule) {
  switch (rule.type) {
    case 'string':
      return typeof value !== 'string' ? `${field} phải là chuỗi` : null;

    case 'number':
      return isNaN(Number(normalizeString(value))) ? `${field} phải là số` : null;

    case 'boolean':
      // After normalizeImportRecord, booleans should already be JS boolean.
      // Accept native boolean OR string 'true'/'false'/'1'/'0'
      if (typeof value === 'boolean') return null;
      return !BOOL_VALID.has(normalizeString(value).toLowerCase())
        ? `${field} phải là true/false (hoặc 1/0, yes/no, có/không)`
        : null;

    case 'email':
      return !EMAIL_REGEX.test(normalizeString(value)) ? `${field} phải là email hợp lệ` : null;

    case 'date':
      return parseDate(value) === null ? `${field} phải là ngày hợp lệ (VD: 01/01/2000 hoặc 2000-01-01)` : null;

    case 'enum':
      // After normalizeImportRecord, value is already the canonical lowercase enum string.
      return !rule.enum.includes(value) ? `${field} phải là một trong: ${rule.enum.join(', ')}` : null;

    case 'array':
      return !Array.isArray(value) ? `${field} phải là một mảng` : null;

    default:
      return null;
  }
}

// ─── convertValue ────────────────────────────────────────────────────────────
export function convertValue(_field: string, value: any, rule: SchemaRule) {
  if (isEmpty(value)) {
    return rule.default !== undefined ? rule.default : null;
  }

  switch (rule.type) {
    case 'number':
      return Number(normalizeString(value));

    case 'boolean': {
      if (typeof value === 'boolean') return value;
      const lower = normalizeString(value).toLowerCase();
      return BOOL_TRUTHY.has(lower);
    }

    case 'date': {
      const parsed = parseDate(value);
      return parsed ? parsed.toISOString() : null;
    }

    case 'email':
      return normalizeString(value).toLowerCase();

    case 'string':
      return normalizeString(value);

    case 'enum':
      // Ensure canonical casing stored in DB
      return rule.enum?.find((e) => e.toLowerCase() === normalizeString(value).toLowerCase()) ?? value;

    case 'array':
      return Array.isArray(value) ? value : [value];

    default:
      return value;
  }
}

// ─── validateFieldConstraints ────────────────────────────────────────────────
export function validateFieldConstraints(field: string, value: any, rule: SchemaRule) {
  if (rule.min !== undefined && Number(value) < rule.min) return `${field} phải lớn hơn hoặc bằng ${rule.min}`;
  if (rule.max !== undefined && Number(value) > rule.max) return `${field} phải nhỏ hơn hoặc bằng ${rule.max}`;
  if (rule.minLength && String(value).length < rule.minLength)
    return `${field} phải có ít nhất ${rule.minLength} ký tự`;
  if (rule.maxLength && String(value).length > rule.maxLength) return `${field} phải có tối đa ${rule.maxLength} ký tự`;
  if (rule.enum && !rule.enum.includes(value)) return `${field} phải là một trong: ${rule.enum.join(', ')}`;
  return null;
}

// ─── transformBySchema ───────────────────────────────────────────────────────
export function transformBySchema(schema: SchemaDefinition | null, data: AnyRecord) {
  if (!schema) return data;

  const transformed: AnyRecord = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (field in data) {
      transformed[field] = convertValue(field, data[field], rule);
    }
  }
  return transformed;
}
