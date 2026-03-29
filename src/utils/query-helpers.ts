export const SPECIAL_QUERY_PARAMS = new Set([
  '_page',
  '_limit',
  '_sort',
  '_order',
  '_q',
  '_embed',
  '_expand',
  'page',
  'limit',
  'sort',
  'order',
  'q',
  'embed',
  'expand',
  'format',
  'columns',
  'includeRelations',
]);

export const QUERY_OPERATOR_SUFFIXES = [
  '_not_like',
  '_ilike',
  '_like',
  '_gte',
  '_lte',
  '_gt',
  '_lt',
  '_ne',
  '_in',
  '_nin',
];

export function hasQueryOperator(key: string) {
  return QUERY_OPERATOR_SUFFIXES.some((suffix) => key.endsWith(suffix));
}

export function castQueryValue(value: any) {
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (typeof value === 'string' && value.startsWith('0') && value.length > 1) return value;
  if (value !== '' && !isNaN(value)) return Number(value);
  return value;
}
