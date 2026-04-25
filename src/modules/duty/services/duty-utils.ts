import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(utc);
dayjs.extend(isoWeek);

export type Identifier = number | string;
export type GenericRecord = Record<string, any>;

export function normalizeId(id: unknown): Identifier {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? (id as Identifier) : parsed;
}

export function normalizeIdList(values: readonly unknown[] = []): Identifier[] {
  return [...new Set(values.map((item) => normalizeId(item)))];
}

export function getActorId(user: any): Identifier {
  if (typeof user === 'object' && user !== null) return normalizeId(user.id);
  return normalizeId(user as Identifier);
}

export function toUTCMidnight(dateInput?: string | number | Date): Date {
  const dStr = dayjs(dateInput || new Date()).format('YYYY-MM-DD');
  return dayjs.utc(dStr).toDate();
}

export function getWeekStartISO(input?: string | number | Date): string {
  const d = dayjs.utc(input || new Date());
  return d.startOf('isoWeek' as any).toISOString();
}

export function getWeekEndISO(weekStartIso: string): string {
  const end = dayjs.utc(weekStartIso).add(6, 'day').endOf('day');
  return end.toISOString();
}
