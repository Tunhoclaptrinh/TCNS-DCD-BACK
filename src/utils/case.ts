function isPlainObject(value: unknown): value is Record<string, any> {
  return Object.prototype.toString.call(value) === '[object Object]';
}

export function toCamelCase(value: string) {
  return String(value || '').replace(/_([a-z0-9])/gi, (_, char: string) => char.toUpperCase());
}

export function camelizeObjectKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => camelizeObjectKeys(item)) as T;
  }

  if (!isPlainObject(value)) {
    return value;
  }

  const normalized: Record<string, any> = {};

  for (const [key, item] of Object.entries(value)) {
    normalized[toCamelCase(key)] = camelizeObjectKeys(item);
  }

  return normalized as T;
}

export function splitKeyBySuffix(key: string, suffixes: string[]) {
  const suffix = [...suffixes].sort((left, right) => right.length - left.length).find((item) => key.endsWith(item));

  if (!suffix) {
    return { field: key, suffix: null };
  }

  return {
    field: key.slice(0, -suffix.length),
    suffix,
  };
}

export function normalizeKeyWithSuffix(key: string, suffixes: string[]) {
  const { field, suffix } = splitKeyBySuffix(key, suffixes);
  return suffix ? `${toCamelCase(field)}${suffix}` : toCamelCase(key);
}
