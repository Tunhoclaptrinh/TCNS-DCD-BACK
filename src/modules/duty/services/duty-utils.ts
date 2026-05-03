import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';

dayjs.extend(utc);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

export type Identifier = number | string;
export type GenericRecord = Record<string, any>;

export type DutyUser = GenericRecord & {
  id: Identifier;
  role?: string;
  name?: string;
  avatar?: string;
  isActive?: boolean;
};

export type DutySlotRecord = GenericRecord & {
  id: Identifier;
  shiftDate: string;
  shiftLabel: string;
  startTime?: string | null;
  endTime?: string | null;
  assignedUserIds?: Identifier[];
  capacity?: number;
  status?: string;
};

export type DutySwapRequestRecord = GenericRecord & {
  id: Identifier;
  dutySlotId: Identifier;
  requesterId: Identifier;
  targetUserId: Identifier;
  status: string;
};

export function normalizeId(id: unknown): Identifier {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? (id as Identifier) : parsed;
}

export function normalizeIdList(values: readonly unknown[] = []): Identifier[] {
  return [...new Set(values.map((item) => normalizeId(item)))];
}

export function getActorId(user: DutyUser | GenericRecord | Identifier): Identifier {
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

export function isTimeInShiftRange(target: string, shiftStart: string, shiftEnd: string): boolean {
  if (!target || !shiftStart || !shiftEnd) return true;
  if (shiftStart <= shiftEnd) {
    return target >= shiftStart && target <= shiftEnd;
  }
  return target >= shiftStart || target <= shiftEnd;
}

/**
 * Check if the provided IP is within the allowed ranges.
 * Ranges are comma-separated. Supports exact IP or simple wildcard (e.g., 192.168.1.*)
 */
export function isIpAllowed(ip: string, allowedRanges: string | string[]): boolean {
  if (!allowedRanges || (Array.isArray(allowedRanges) && allowedRanges.length === 0)) return true;
  const ranges = Array.isArray(allowedRanges) ? allowedRanges : allowedRanges.split(',').map((r) => r.trim());

  const clientIp = ip.replace('::ffff:', ''); // Handle IPv4-mapped IPv6

  return ranges.some((range) => {
    if (range === clientIp) return true;
    if (range.endsWith('*')) {
      const prefix = range.slice(0, -1);
      return clientIp.startsWith(prefix);
    }
    return false;
  });
}
