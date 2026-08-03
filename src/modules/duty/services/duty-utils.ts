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

/**
 * Find the most relevant quota rule for a user within a set of rules.
 * Priority: Specific User (MSV) > Role + Dept > Role Global > Default
 */
export function findMatchingQuotaRule(user: any, rules: any[], options: { startDate?: string; endDate?: string } = {}) {
  if (!user || !rules || !Array.isArray(rules)) return null;

  const { startDate, endDate } = options;
  const start = startDate ? dayjs(startDate) : null;
  const end = endDate ? dayjs(endDate) : null;

  const userId = normalizeId(user.id);
  const studentId = user.studentId;
  const pos = String(user.position || '').toLowerCase();
  const p = Array.isArray(user.permissions) ? user.permissions : [];
  const uDept = String(user.department?.name || user.department || '').trim();

  const isRuleActive = (r: any) => {
    if (!start || !end || !r.startDate || !r.endDate) return true;
    return dayjs(r.startDate).isBefore(end) && dayjs(r.endDate).isAfter(start);
  };

  // 1. Specific User Rule (Highest Priority)
  const userRule = rules.find(
    (r: any) =>
      r.type === 'user' &&
      String(r.target).toLowerCase() === String(studentId || userId).toLowerCase() &&
      isRuleActive(r),
  );
  if (userRule) return userRule;

  const roleMatch = (r: any) => {
    const type = r.type;
    const target = String(r.target || '').toLowerCase();
    if (type === 'dt') return pos === 'dt' || pos.includes('đội trưởng');
    if (type === 'tb') return pos === 'tb' || pos.includes('trưởng ban');
    if (type === 'pb') return pos === 'pb' || pos.includes('phó ban');
    if (type === 'ctv') return pos === 'ctv';
    if (type === 'member_all') return !pos.includes('trưởng') && !pos.includes('đội');
    if (type === 'role_group') return p.includes('*') || p.includes('duty:manage') ? 'Management' === target : false;
    return false;
  };

  // 2. Role + Dept Match
  const roleDeptRule = rules.find(
    (r: any) =>
      roleMatch(r) &&
      r.target !== 'all' &&
      r.target !== undefined &&
      String(r.target).toLowerCase() === uDept.toLowerCase() &&
      isRuleActive(r),
  );
  if (roleDeptRule) return roleDeptRule;

  // 3. Role Global Match
  const roleAllRule = rules.find(
    (r: any) => roleMatch(r) && (r.target === 'all' || r.target === undefined) && isRuleActive(r),
  );
  if (roleAllRule) return roleAllRule;

  return null;
}
