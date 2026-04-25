import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import BaseService from '@shared/common/base-service';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import dutyDaysRepository from '@modules/duty/repositories/duty-days.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutyLogsRepository from '@modules/duty/repositories/duty-logs.repository';
import dutySettingsRepository from '@modules/duty/repositories/duty-settings.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import dutyTemplateShiftsRepository from '@modules/duty/repositories/duty-template-shifts.repository';
import dutyTemplateKipsRepository from '@modules/duty/repositories/duty-template-kips.repository';
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import db from '@database';
import ApiError from '@utils/api-error';
import notificationService from '@modules/notifications/services/notification.service';
import { socketService } from '../../../services/socket.service';

dayjs.extend(utc);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type Identifier = number | string;
type GenericRecord = Record<string, any>;
type DutyUser = GenericRecord & {
  id: Identifier;
  role?: string;
  name?: string;
  avatar?: string;
  isActive?: boolean;
};
type DutySlotRecord = GenericRecord & {
  id: Identifier;
  shiftDate: string;
  shiftLabel: string;
  startTime?: string | null;
  endTime?: string | null;
  assignedUserIds?: Identifier[];
  capacity?: number;
  status?: string;
};
type DutySwapRequestRecord = GenericRecord & {
  id: Identifier;
  dutySlotId: Identifier;
  requesterId: Identifier;
  targetUserId: Identifier;
  status: string;
};

function normalizeId(id: unknown): Identifier {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? (id as Identifier) : parsed;
}

function normalizeIdList(values: readonly unknown[] = []): Identifier[] {
  return [...new Set(values.map((item) => normalizeId(item)))];
}

function getActorId(user: DutyUser | GenericRecord | Identifier): Identifier {
  if (typeof user === 'object' && user !== null) return normalizeId(user.id);
  return normalizeId(user as Identifier);
}

function toUTCMidnight(dateInput?: string | number | Date): Date {
  // Extract YYYYY-MM-DD and force to UTC 00:00:00.000
  const dStr = dayjs(dateInput || new Date()).format('YYYY-MM-DD');
  return dayjs.utc(dStr).toDate();
}

function getWeekStartISO(input?: string | number | Date): string {
  const d = dayjs.utc(input || new Date());
  // dayjs.startOf('isoWeek') uses Monday as start
  return d.startOf('isoWeek' as any).toISOString();
}

function getWeekEndISO(weekStartIso: string): string {
  const end = dayjs.utc(weekStartIso).add(6, 'day').endOf('day');
  return end.toISOString();
}

class DutyService extends BaseService {
  constructor() {
    super('duty_slots', dutySlotsRepository);
  }

  getAssignedUserIds(slot: DutySlotRecord) {
    return normalizeIdList(slot.assignedUserIds || []);
  }

  getSlotCapacity(slot: DutySlotRecord) {
    return Math.max(1, Number(slot.capacity) || 1);
  }

  isTimeInShiftRange(target: string, shiftStart: string, shiftEnd: string): boolean {
    if (!target || !shiftStart || !shiftEnd) return true;
    if (shiftStart <= shiftEnd) {
      return target >= shiftStart && target <= shiftEnd;
    }
    return target >= shiftStart || target <= shiftEnd;
  }

  buildScheduleUserMap(users: DutyUser[]) {
    return new Map(users.map((user) => [normalizeId(user.id), user]));
  }

  async getSlotLabel(slot: any) {
    if (slot.shiftLabel) return slot.shiftLabel; // legacy
    const kip = await dutyKipsRepository.findById(slot.kipId);
    if (!kip) return 'Kíp trực';
    const shift = await dutyShiftsRepository.findById(kip.shiftId);
    if (!shift) return kip.name;
    return `${shift.name} - ${kip.name}`;
  }

  async findSlotOrThrow(slotId: Identifier) {
    const slot = (await this.repository.findById(slotId)) as DutySlotRecord | null;
    if (!slot) {
      throw ApiError.notFound('Duty slot not found');
    }
    return slot;
  }

  async saveAssignedUsers(slotId: Identifier, assignedUserIds: Identifier[], updatedAt = new Date().toISOString()) {
    return await this.repository.update(slotId, {
      assignedUserIds,
      updatedAt,
    });
  }

  async notifySlotAssignment(userId: Identifier, slot: DutySlotRecord, action: 'register' | 'cancel') {
    const label = await this.getSlotLabel(slot);
    const title = action === 'register' ? 'Đăng ký ca trực thành công' : 'Hủy ca trực thành công';
    const message =
      action === 'register'
        ? `Bạn đã đăng ký ca '${label}' ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}.`
        : `Bạn đã hủy ca '${label}' ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}.`;

    await notificationService.notifyUser(userId, {
      title,
      message,
      category: 'shift',
      type: 'shift',
      refId: slot.id,
      metadata: { action },
    });
  }

  getApproverIds(users: DutyUser[]) {
    return users
      .filter((user) => user.isActive && (user.role === 'admin' || user.role === 'staff'))
      .map((user) => normalizeId(user.id));
  }

  parseSwapDecision(payload: GenericRecord = {}) {
    const decision = String(payload.decision || payload.status || '').toLowerCase();
    const note = String(payload.note || payload.reason || payload.decisionNote || '').trim();

    if (!['approved', 'rejected'].includes(decision)) {
      throw ApiError.badRequest("decision must be 'approved' or 'rejected'");
    }

    return {
      decision: decision as 'approved' | 'rejected',
      note,
    };
  }

  async applyApprovedSwapRequest(swapRequest: DutySwapRequestRecord, updatedAt: string) {
    const slot = await this.findSlotOrThrow(swapRequest.dutySlotId);
    const requesterId = normalizeId(swapRequest.requesterId);
    const targetUserId = normalizeId(swapRequest.targetUserId);
    const assigned = this.getAssignedUserIds(slot);

    if (!assigned.includes(requesterId)) {
      throw ApiError.badRequest('Requester is no longer assigned to this duty slot');
    }

    if (assigned.includes(targetUserId)) {
      throw ApiError.badRequest('Target user is already assigned to this duty slot');
    }

    const nextAssigned = [...assigned.filter((id) => id !== requesterId), targetUserId];
    await this.saveAssignedUsers(slot.id, nextAssigned, updatedAt);
  }

  async notifySwapDecision(swapRequest: DutySwapRequestRecord, decision: 'approved' | 'rejected', note: string) {
    if (decision === 'approved') {
      await notificationService.notifyUser(swapRequest.requesterId, {
        title: 'Yêu cầu đổi ca đã được duyệt',
        message: 'Yêu cầu đổi ca của bạn đã được chấp thuận.',
        category: 'approval',
        type: 'approval',
        refId: swapRequest.id,
        metadata: { decision: 'approved' },
      });

      await notificationService.notifyUser(swapRequest.targetUserId, {
        title: 'Bạn đã được phân ca mới',
        message: 'Yêu cầu đổi ca đã được duyệt và ca trực đã được cập nhật cho bạn.',
        category: 'approval',
        type: 'approval',
        refId: swapRequest.id,
        metadata: { decision: 'approved' },
      });
      return;
    }

    await notificationService.notifyUser(swapRequest.requesterId, {
      title: 'Yêu cầu đổi ca bị từ chối',
      message: note || 'Yêu cầu đổi ca của bạn đã bị từ chối.',
      category: 'approval',
      type: 'approval',
      refId: swapRequest.id,
      metadata: { decision: 'rejected' },
    });
  }

  async notifySwapRequestCreated(
    slot: DutySlotRecord,
    swapRequestId: Identifier,
    requesterId: Identifier,
    targetUserId: Identifier,
    approverIds: Identifier[],
  ) {
    await notificationService.notifyUser(requesterId, {
      title: 'Yêu cầu đổi ca đã gửi',
      message: `Yêu cầu đổi ca '${slot.shiftLabel}' của bạn đang chờ duyệt.`,
      category: 'approval',
      type: 'approval',
      refId: swapRequestId,
      metadata: { action: 'swap_request_created' },
    });

    await notificationService.notifyUser(targetUserId, {
      title: 'Bạn có yêu cầu nhận ca trực',
      message: `Bạn vừa nhận được yêu cầu đổi ca '${slot.shiftLabel}'.`,
      category: 'approval',
      type: 'approval',
      refId: swapRequestId,
      metadata: { action: 'swap_requested_to_you' },
    });

    await notificationService.notifyUsers(approverIds, {
      title: 'Yêu cầu duyệt đổi ca',
      message: `Có yêu cầu đổi ca mới cần duyệt cho ca '${slot.shiftLabel}'.`,
      category: 'approval',
      type: 'approval',
      refId: swapRequestId,
      metadata: { action: 'swap_pending_review' },
    });
  }

  buildSlotPayload(data: GenericRecord = {}, createdBy: Identifier | null = null) {
    const shiftDate = toUTCMidnight(data.shiftDate);
    const weekStartStr = getWeekStartISO(data.weekStart || shiftDate);

    return {
      weekStart: toUTCMidnight(weekStartStr),
      shiftDate,
      dayId: data.dayId ? normalizeId(data.dayId) : null,
      shiftId: data.shiftId ? normalizeId(data.shiftId) : null,
      kipId: data.kipId ? normalizeId(data.kipId) : null,
      shiftLabel: data.shiftLabel || 'Kíp trực',
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      assignedUserIds: normalizeIdList(data.assignedUserIds || []),
      status: data.status || 'open',
      createdBy: normalizeId(data.createdBy || createdBy),
      note: data.note || '',
      capacity: data.capacity ? Number(data.capacity) : null,
      isSpecialEvent: !!data.isSpecialEvent,
      slotStructure: Array.isArray(data.slotStructure) ? data.slotStructure : [],
      config: typeof data.config === 'object' ? data.config : {},
      createdAt: new Date(data.createdAt || new Date()),
      updatedAt: new Date(),
    };
  }

  // ==================== SETTINGS MANAGEMENT ====================

  async getSettings() {
    const settings = await dutySettingsRepository.getGlobalSettings();
    if (!settings) {
      // Return default settings
      return {
        weeklyKipLimit: 0, // 0 means no limit
        allowUnregisterWhenFull: true,
        currentGeneration: '',
        generations: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return settings;
  }

  async updateSettings(data: GenericRecord) {
    const settings = await dutySettingsRepository.getGlobalSettings();
    const payload = {
      weeklyKipLimit: Number(data.weeklyKipLimit) || 0,
      allowUnregisterWhenFull: data.allowUnregisterWhenFull !== false,
      currentGeneration: data.currentGeneration || '',
      generations: Array.isArray(data.generations) ? data.generations : [],
      updatedAt: new Date().toISOString(),
    };

    if (!settings) {
      return await dutySettingsRepository.create(payload);
    }
    return await dutySettingsRepository.update(settings.id, payload);
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  async getTemplates() {
    const all = await dutyTemplatesRepository.findAll();
    return all.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }

  async createTemplate(data: GenericRecord) {
    const template = await dutyTemplatesRepository.create({
      name: data.name,
      isDefault: !!data.isDefault,
      description: data.description || '',
    });
    if (data.isDefault) {
      const all = await dutyTemplatesRepository.findAll();
      for (const t of all) {
        if (normalizeId(t.id) !== normalizeId(template.id) && t.isDefault) {
          await dutyTemplatesRepository.update(t.id, { isDefault: false });
        }
      }
    }
    return template;
  }

  async updateTemplate(id: Identifier, data: GenericRecord) {
    const updated = await dutyTemplatesRepository.update(id, {
      name: data.name,
      isDefault: !!data.isDefault,
      description: data.description || '',
    });
    if (data.isDefault) {
      const all = await dutyTemplatesRepository.findAll();
      for (const t of all) {
        if (normalizeId(t.id) !== normalizeId(id) && t.isDefault) {
          await dutyTemplatesRepository.update(t.id, { isDefault: false });
        }
      }
    }
    return updated;
  }

  async deleteTemplate(id: Identifier) {
    const shifts = await dutyTemplateShiftsRepository.findByTemplateId(normalizeId(id));
    for (const s of shifts) {
      await this.deleteShiftTemplate(s.id);
    }
    return await dutyTemplatesRepository.delete(id);
  }

  async getShiftTemplates(templateId?: Identifier | null) {
    let filter: any = {};
    if (templateId !== undefined) {
      if (templateId) {
        filter.templateId = normalizeId(templateId);
      } else if (templateId === null) {
        filter.templateId = null;
      }
    } else {
      filter = {};
    }

    const shifts = await dutyTemplateShiftsRepository.findMany(filter);
    const kips = await dutyTemplateKipsRepository.findAll();
    return shifts
      .map((shift: any) => ({
        ...shift,
        kips: kips
          .filter((k: any) => normalizeId(k.templateShiftId) === normalizeId(shift.id))
          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
      }))
      .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  async createShiftTemplate(data: GenericRecord) {
    return await dutyTemplateShiftsRepository.create({
      templateId: data.templateId ? normalizeId(data.templateId) : null,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isSpecialEvent: !!data.isSpecialEvent,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    });
  }

  private getDayName(day: number) {
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    return days[day] || `Ngày ${day}`;
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
    const newDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : undefined;
    if (newDays) {
      const kips = await dutyTemplateKipsRepository.findByTemplateShiftId(id);
      for (const kip of kips) {
        const kipDays = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        const invalid = kipDays.filter((d) => !newDays.includes(d));
        if (invalid.length > 0) {
          const invalidNames = invalid.map((d) => this.getDayName(d)).join(', ');
          throw ApiError.badRequest(
            `Không thể cập nhật: Kíp '${kip.name}' đang có ngày trực (${invalidNames}) không nằm trong danh sách ngày mới của Ca.`,
          );
        }
      }
    }

    return await dutyTemplateShiftsRepository.update(id, {
      templateId: data.templateId ? normalizeId(data.templateId) : undefined,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isSpecialEvent: data.isSpecialEvent !== undefined ? !!data.isSpecialEvent : undefined,
      daysOfWeek: newDays,
    });
  }

  async deleteShiftTemplate(id: Identifier) {
    await dutyTemplateKipsRepository.deleteByTemplateShiftId(normalizeId(id));
    return await dutyTemplateShiftsRepository.delete(id);
  }

  async createKipTemplate(data: GenericRecord) {
    const shiftId = normalizeId(data.templateShiftId || data.shiftId);
    const kipDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6];

    // Validate against parent shift
    const shift = await dutyTemplateShiftsRepository.findById(shiftId);
    if (shift) {
      const shiftDays = shift.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      const invalid = kipDays.filter((d) => !shiftDays.includes(d));
      if (invalid.length > 0) {
        const invalidNames = invalid.map((d) => this.getDayName(d)).join(', ');
        throw ApiError.badRequest(`Kíp có ngày trực không thuộc Ca trực (${invalidNames}).`);
      }
    }

    return await dutyTemplateKipsRepository.create({
      templateShiftId: shiftId,
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      daysOfWeek: kipDays,
      description: data.description || '',
    });
  }

  async updateKipTemplate(id: Identifier, data: GenericRecord) {
    const kip = await dutyTemplateKipsRepository.findById(id);
    if (!kip) throw ApiError.notFound('Kíp không tồn tại');

    const kipDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : undefined;

    if (kipDays) {
      const shift = await dutyTemplateShiftsRepository.findById(kip.templateShiftId);
      if (shift) {
        const shiftDays = shift.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        const invalid = kipDays.filter((d) => !shiftDays.includes(d));
        if (invalid.length > 0) {
          const invalidNames = invalid.map((d) => this.getDayName(d)).join(', ');
          throw ApiError.badRequest(`Kíp có ngày trực không thuộc Ca trực (${invalidNames}).`);
        }
      }
    }

    return await dutyTemplateKipsRepository.update(id, {
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      daysOfWeek: kipDays || kip.daysOfWeek,
      description: data.description || '',
    });
  }

  async deleteKipTemplate(id: Identifier) {
    return await dutyTemplateKipsRepository.delete(id);
  }

  async findOrCreateDay(date: string, actorId: Identifier) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const isoDate = d.toISOString();

    let dayRecord = await dutyDaysRepository.findByDate(isoDate);
    if (!dayRecord) {
      dayRecord = await dutyDaysRepository.create({
        date: isoDate,
        dayOfWeek: (new Date(isoDate).getUTCDay() + 6) % 7,
        status: 'open',
        createdBy: normalizeId(actorId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return dayRecord;
  }

  async generateWeekSlots(weekStart: string, actorId: Identifier) {
    const startIso = getWeekStartISO(weekStart);
    const ws = new Date(startIso);
    const we = new Date(startIso);
    we.setUTCDate(we.getUTCDate() + 6);

    const existingShifts = await dutyShiftsRepository.findMany({
      date_gte: ws.toISOString(),
      date_lte: we.toISOString(),
    });
    if (existingShifts.length > 0) throw ApiError.badRequest('Lịch đã tồn tại cho tuần này');

    const assignments = await dutyTemplateAssignmentsRepository.findMany({
      startDate_lte: we.toISOString(),
      endDate_gte: ws.toISOString(),
    });

    const defaultGroup = await dutyTemplatesRepository.findDefault();

    for (let i = 0; i < 7; i++) {
      const d = new Date(startIso);
      d.setUTCDate(d.getUTCDate() + i);
      const isoDate = d.toISOString();

      const assignment = assignments.find((a: any) => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        return d >= start && d <= end;
      });

      const groupId = assignment?.templateId || defaultGroup?.id;
      if (!groupId) continue;

      const templateShifts = await dutyTemplateShiftsRepository.findByTemplateId(normalizeId(groupId));
      for (const ts of templateShifts) {
        const dIdx = (d.getUTCDay() + 6) % 7;
        if ((ts.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dIdx)) {
          await this.stampTemplateShift(isoDate, ts.id, actorId);
        }
      }
    }

    return { success: true };
  }

  async generateDaySlots(date: string, actorId: Identifier) {
    const d = toUTCMidnight(date);
    const isoDate = d.toISOString();
    const dayOfWeek = (d.getUTCDay() + 6) % 7;

    const assignment = await dutyTemplateAssignmentsRepository.findOne({
      startDate_lte: isoDate,
      endDate_gte: isoDate,
    });

    let effectiveTemplateId: Identifier | undefined = assignment?.templateId;
    if (!effectiveTemplateId) {
      const defaultTemplate = await dutyTemplatesRepository.findDefault();
      effectiveTemplateId = defaultTemplate?.id;
    }

    if (!effectiveTemplateId) return { success: false, message: 'No template assigned' };

    const templateShifts = await dutyTemplateShiftsRepository.findByTemplateId(normalizeId(effectiveTemplateId));
    const results = [];
    for (const ts of templateShifts) {
      if ((ts.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek)) {
        const stamped = await this.stampTemplateShift(isoDate, ts.id, actorId);
        results.push(stamped);
      }
    }

    return { success: true, results };
  }

  async generateRangeSlots(
    startDate: string,
    endDate: string,
    actorId: Identifier,
    templateId?: Identifier,
    mode: string = 'all',
    jobId?: string,
  ) {
    const s = toUTCMidnight(startDate);
    const e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);

    if (e < s) throw ApiError.badRequest('Ngày kết thúc phải sau ngày bắt đầu');

    if (jobId) {
      socketService.emitToRoom(jobId, 'job_progress', { percent: 5, text: 'Bắt đầu quá trình lập lịch...' });
    }

    let effectiveTemplateId = templateId;
    if (!effectiveTemplateId) {
      const assignments = await dutyTemplateAssignmentsRepository.findMany({
        startDate_lte: e.toISOString(),
        endDate_gte: s.toISOString(),
      });
      const assignment = assignments.find(
        (a: any) =>
          dayjs.utc(s).isSameOrAfter(dayjs.utc(a.startDate), 'day') &&
          dayjs.utc(e).isSameOrBefore(dayjs.utc(a.endDate), 'day'),
      );
      effectiveTemplateId = assignment?.templateId;
      if (!effectiveTemplateId) {
        const defaultTemplate = await dutyTemplatesRepository.findDefault();
        effectiveTemplateId = defaultTemplate?.id;
      }
    }

    if (!effectiveTemplateId) return { success: false, message: 'Không tìm thấy Bản mẫu để áp dụng' };

    const templateShifts = await dutyTemplateShiftsRepository.findByTemplateId(normalizeId(effectiveTemplateId));

    let curr = new Date(s);
    const datesToProcess: string[] = [];
    while (curr <= e) {
      datesToProcess.push(curr.toISOString());
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const totalDays = datesToProcess.length;
    const results = [];

    for (let i = 0; i < totalDays; i++) {
      const isoDate = datesToProcess[i];
      const dayOfWeek = (new Date(isoDate).getUTCDay() + 6) % 7;

      if (jobId && i % 5 === 0) {
        const percent = Math.floor(10 + (i / totalDays) * 85);
        socketService.emitToRoom(jobId, 'job_progress', {
          percent,
          text: `Đang xử lý ngày ${dayjs(isoDate).format('DD/MM')}...`,
        });
      }

      for (const ts of templateShifts) {
        if ((ts.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek)) {
          const stamped = await this.stampTemplateShift(isoDate, ts.id, actorId, mode);
          results.push(stamped);
        }
      }
    }

    if (jobId) {
      socketService.emitToRoom(jobId, 'job_progress', { percent: 100, text: 'Lập lịch hoàn tất!' });
    }

    return { success: true, results };
  }

  async stampTemplateShift(date: string, templateShiftId: Identifier, actorId: Identifier, mode: string = 'all') {
    const dayRecord = await this.findOrCreateDay(date, actorId);
    const ts = await dutyTemplateShiftsRepository.findById(templateShiftId);
    if (!ts) return null;

    let actualShift = await dutyShiftsRepository.findOne({
      date: date,
      fromTemplateShiftId: ts.id,
    });

    if (!actualShift) {
      actualShift = await dutyShiftsRepository.create({
        dayId: dayRecord.id,
        date: date,
        name: ts.name,
        startTime: ts.startTime,
        endTime: ts.endTime,
        isSpecialEvent: !!ts.isSpecialEvent,
        fromTemplateShiftId: ts.id,
        status: 'open',
        createdBy: normalizeId(actorId),
      });
    }

    if (mode === 'shifts') return actualShift;

    const tKips = await dutyTemplateKipsRepository.findByTemplateShiftId(ts.id);
    for (const tk of tKips) {
      const dayOfWeek = (dayjs.utc(date).day() + 6) % 7;
      if (!(tk.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek)) continue;

      let ak = await dutyKipsRepository.findOne({
        shiftId: actualShift.id,
        fromTemplateKipId: tk.id,
      });

      if (!ak) {
        ak = await dutyKipsRepository.create({
          shiftId: actualShift.id,
          date: date,
          name: tk.name,
          coefficient: tk.coefficient,
          capacity: tk.capacity,
          startTime: tk.startTime,
          endTime: tk.endTime,
          fromTemplateKipId: tk.id,
          slotStructure: tk.slotStructure || [],
          config: tk.config || {},
          status: 'open',
        });
      }

      const existingSlot = await dutySlotsRepository.findOne({ kipId: ak.id });
      if (!existingSlot) {
        const weekStart = dayjs.utc(date).startOf('isoWeek').toDate();
        await dutySlotsRepository.create({
          kipId: ak.id,
          shiftId: actualShift.id,
          dayId: dayRecord.id,
          weekStart: weekStart,
          shiftDate: date,
          startTime: ak.startTime,
          endTime: ak.endTime,
          capacity: ak.capacity,
          status: 'open',
          createdBy: normalizeId(actorId),
          note: 'INSTANCE',
        });
      }
    }

    return actualShift;
  }

  async deleteRangeSlots(startDate: string, endDate: string, performerId: Identifier) {
    const s = toUTCMidnight(startDate);
    const e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);

    const deletedCount = await dutySlotsRepository.deleteMany({
      shiftDate_gte: s.toISOString(),
      shiftDate_lte: e.toISOString(),
    });

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'unassigned',
      action: 'removed',
      slotId: 0, // Batch action
      userId: performerId,
      performerId: normalizeId(performerId),
      details: `Admin xóa hàng loạt kíp trực từ ${startDate} đến ${endDate}. Số lượng: ${deletedCount}`,
      createdAt: new Date(),
    });

    return deletedCount;
  }

  async copyWeekSchedule(sourceWeekStart: string, targetWeekStart: string, actorId: Identifier) {
    const srcIso = getWeekStartISO(sourceWeekStart);
    const targetIso = getWeekStartISO(targetWeekStart);

    const wsSource = new Date(srcIso);
    const weSource = new Date(srcIso);
    weSource.setUTCDate(weSource.getUTCDate() + 6);

    const wsTarget = new Date(targetIso);
    const weTarget = new Date(targetIso);
    weTarget.setUTCDate(weTarget.getUTCDate() + 6);

    // 1. Check if target week already has shifts
    const existingTarget = await dutyShiftsRepository.findOne({
      date_gte: wsTarget.toISOString(),
      date_lte: weTarget.toISOString(),
    });
    if (existingTarget) throw ApiError.badRequest('Tuần đích đã có lịch trực');

    // 2. Fetch all shifts for source week
    const sourceShifts = await dutyShiftsRepository.findMany({
      date_gte: wsSource.toISOString(),
      date_lte: weSource.toISOString(),
    });

    if (sourceShifts.length === 0) throw ApiError.badRequest('Tuần nguồn không có lịch trực');

    for (const ss of sourceShifts) {
      const srcDate = dayjs.utc(ss.date);
      const dayOffset = srcDate.diff(dayjs.utc(srcIso), 'day');
      const targetDate = dayjs.utc(targetIso).add(dayOffset, 'day').toISOString();

      // Stamp based on the same template if available, or just clone the instance
      if (ss.fromTemplateShiftId) {
        await this.stampTemplateShift(targetDate, ss.fromTemplateShiftId, actorId);
      } else {
        // Manual clone for ad-hoc shifts
        const dayRecord = await this.findOrCreateDay(targetDate, actorId);
        const newShift = await dutyShiftsRepository.create({
          ...ss,
          id: undefined,
          _id: undefined,
          dayId: dayRecord.id,
          date: targetDate,
          createdBy: normalizeId(actorId),
        });

        // Clone kips and slots
        const kips = await dutyKipsRepository.findMany({ shiftId: ss.id });
        for (const k of kips) {
          const newKip = await dutyKipsRepository.create({
            ...k,
            id: undefined,
            _id: undefined,
            shiftId: newShift.id,
            date: targetDate,
          });

          const slots = await dutySlotsRepository.findMany({ kipId: k.id });
          for (const s of slots) {
            await dutySlotsRepository.create({
              ...s,
              id: undefined,
              _id: undefined,
              kipId: newKip.id,
              shiftDate: targetDate,
              assignedUserIds: [], // Don't copy assignments for a new week usually
              status: 'open',
              createdBy: normalizeId(actorId),
            });
          }
        }
      }
    }

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: 0,
      userId: actorId,
      performerId: normalizeId(actorId),
      details: `Admin sao chép lịch trực từ tuần ${sourceWeekStart} sang tuần ${targetWeekStart}.`,
      createdAt: new Date(),
    });

    return { success: true };
  }

  async deleteWeeklySlots(weekStart: string) {
    const ws = dayjs(weekStart).startOf('isoWeek' as any);
    const we = ws.endOf('isoWeek' as any);

    // 1. Delete all slots for the week
    await dutySlotsRepository.deleteMany({
      shiftDate_gte: ws.toDate(),
      shiftDate_lte: we.toDate(),
    });

    // 2. Delete all kips for the week
    await dutyKipsRepository.deleteMany({
      date_gte: ws.toDate(),
      date_lte: we.toDate(),
    });

    // 3. Delete all shifts for the week
    await dutyShiftsRepository.deleteMany({
      date_gte: ws.toDate(),
      date_lte: we.toDate(),
    });

    return { success: true };
  }

  async getWeeklySchedule(options: any = {}) {
    const weekStart = getWeekStartISO(options.weekStart);
    const weekEnd = getWeekEndISO(weekStart);

    const ws = dayjs(weekStart);
    const we = dayjs(weekEnd);

    // 1. Fetch Days
    const days = await dutyDaysRepository.findMany({
      date_gte: ws.toISOString(),
      date_lte: we.toISOString(),
    });

    // 2. Fetch Actual Shifts for these days
    const shifts = await dutyShiftsRepository.findMany({
      date_gte: ws.toDate(),
      date_lte: we.toDate(),
    });

    // 3. Fetch Actual Kips for these shifts
    const kips = await dutyKipsRepository.findMany({
      date_gte: ws.toDate(),
      date_lte: we.toDate(),
    });

    // 4. Fetch Slots for these kips
    const slotsResult = await dutySlotsRepository.findAllAdvanced({
      limit: 1000,
      filter: {
        shiftDate_gte: ws.toDate(),
        shiftDate_lte: we.toDate(),
      },
    });

    const users = (await usersRepository.findAll()) as DutyUser[];
    const userMap = this.buildScheduleUserMap(users);

    const slots = slotsResult.data.map((slot: any) => {
      const assignedIds = normalizeIdList(slot.assignedUserIds || []);

      // Improved lookup: Find kip first, then shift
      let kip = kips.find((k: any) => normalizeId(k.id) === normalizeId(slot.kipId));
      if (!kip && slot.kipId) {
        // Fallback if kips weren't fetched by date correctly
        console.warn(`Kip ${slot.kipId} not found in pre-fetched list for slot ${slot.id}`);
      }

      const shift = shifts.find((s: any) => normalizeId(s.id) === normalizeId(slot.shiftId || kip?.shiftId));

      return {
        ...slot,
        shiftLabel: shift && kip ? `${shift.name} - ${kip.name}` : kip?.name || 'Kíp trực',
        startTime: slot.startTime || kip?.startTime || shift?.startTime,
        endTime: slot.endTime || kip?.endTime || shift?.endTime,
        assignedUsers: assignedIds
          .map((id) => userMap.get(id))
          .filter(Boolean)
          .map((user: any) => ({
            id: user.id,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
          })),
      };
    });

    // 5. Fetch Assignments for context
    const assignments = await dutyTemplateAssignmentsRepository.findMany({
      startDate_lte: we.toISOString(),
      endDate_gte: ws.toISOString(),
    });

    // Build hierarchical templateData for the timeline
    const templateData = shifts.map((s: any) => ({
      ...s,
      kips: kips
        .filter((k: any) => normalizeId(k.shiftId) === normalizeId(s.id))
        .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
    }));

    return {
      success: true,
      data: {
        slots,
        days,
        assignments,
        templates: templateData,
      },
      weekStart,
      weekEnd,
    };
  }

  async createActualShift(payload: GenericRecord, actorId: Identifier) {
    if (!payload.date) throw ApiError.badRequest('Ngày là bắt buộc');
    const dayRecord = await this.findOrCreateDay(payload.date, actorId);

    const created = await dutyShiftsRepository.create({
      dayId: dayRecord.id,
      date: payload.date,
      name: payload.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: 'open',
      createdBy: normalizeId(actorId),
      note: payload.note || '',
    });

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: 0,
      userId: normalizeId(actorId),
      performerId: normalizeId(actorId),
      details: `Tạo ca trực mới: ${created.name} (${created.startTime} - ${created.endTime}).`,
      createdAt: new Date(),
    });

    return created;
  }

  async createActualKip(payload: GenericRecord, actorId: Identifier) {
    if (!payload.shiftId) throw ApiError.badRequest('shiftId là bắt buộc');
    const shift = await dutyShiftsRepository.findById(payload.shiftId);
    if (!shift) throw ApiError.notFound('Ca trực không tồn tại');

    // Validate time range against parent shift
    if (payload.startTime && !this.isTimeInShiftRange(payload.startTime, shift.startTime, shift.endTime)) {
      throw ApiError.badRequest(
        `Giờ bắt đầu (${payload.startTime}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
      );
    }
    if (payload.endTime && !this.isTimeInShiftRange(payload.endTime, shift.startTime, shift.endTime)) {
      throw ApiError.badRequest(
        `Giờ kết thúc (${payload.endTime}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
      );
    }

    const createdKip = await dutyKipsRepository.create({
      shiftId: shift.id,
      date: shift.date,
      name: payload.name,
      coefficient: Number(payload.coefficient) || 1,
      capacity: Number(payload.capacity) || 1,
      startTime: payload.startTime || null,
      endTime: payload.endTime || null,
      slotStructure: payload.slotStructure || [],
      config: payload.config || {},
      status: 'open',
      note: payload.note || '',
    });

    // Create a slot for this kip
    await dutySlotsRepository.create({
      kipId: createdKip.id,
      shiftDate: shift.date,
      capacity: createdKip.capacity,
      status: 'open',
      createdBy: normalizeId(actorId),
    });

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: 0,
      userId: normalizeId(actorId),
      performerId: normalizeId(actorId),
      details: `Tạo kíp trực mới: ${createdKip.name} thuộc ca ${shift.name}.`,
      createdAt: new Date(),
    });

    return createdKip;
  }

  async createSlot(payload: GenericRecord, actorId: Identifier) {
    if (!payload.kipId) throw ApiError.badRequest('kipId là bắt buộc');
    const kip = await dutyKipsRepository.findById(payload.kipId);
    if (!kip) throw ApiError.notFound('Kíp không tồn tại');

    const data = {
      kipId: kip.id,
      shiftDate: kip.date,
      capacity: payload.capacity || kip.capacity,
      assignedUserIds: normalizeIdList(payload.assignedUserIds || []),
      status: 'open',
      createdBy: normalizeId(actorId),
      note: payload.note || '',
      config: payload.config || {},
    };

    const created = await dutySlotsRepository.create(data);

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: created.id,
      userId: normalizeId(actorId),
      performerId: normalizeId(actorId),
      details: `Admin tạo phiên đăng ký mới cho kíp: ${kip.name}`,
      createdAt: new Date(),
    });

    return created;
  }

  async deleteSlot(id: Identifier, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(id);
    if (!slot) throw ApiError.notFound('Phiên không tồn tại');

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'unassigned',
      action: 'removed',
      slotId: normalizeId(id),
      userId: normalizeId(performerId), // Use performer as target
      performerId: normalizeId(performerId),
      details: `Admin xóa phiên đăng ký của ngày ${new Date(slot.shiftDate).toLocaleDateString()}`,
      createdAt: new Date(),
    });

    await dutySlotsRepository.delete(id);
    return { success: true };
  }

  async deleteShiftSlots(date: string, shiftId: number, performerId: Identifier) {
    // This now deletes all kips and slots of a shift
    const kips = await dutyKipsRepository.findByShiftId(shiftId);
    for (const k of kips) {
      await dutySlotsRepository.deleteMany({ kipId: k.id });
      await dutyKipsRepository.delete(k.id);
    }
    await dutyShiftsRepository.delete(shiftId);

    return { success: true };
  }

  async updateSlot(slotId: Identifier, payload: GenericRecord = {}, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    // 1. Validation BEFORE any database modification
    if (slot.kipId && (payload.startTime !== undefined || payload.endTime !== undefined)) {
      const kip = await dutyKipsRepository.findById(slot.kipId);
      const shiftId = kip?.shiftId || slot.shiftId;

      if (shiftId) {
        const shift = await dutyShiftsRepository.findById(shiftId);
        if (shift) {
          const st = payload.startTime ?? slot.startTime ?? kip?.startTime;
          const et = payload.endTime ?? slot.endTime ?? kip?.endTime;

          if (st && !this.isTimeInShiftRange(st, shift.startTime, shift.endTime)) {
            throw ApiError.badRequest(
              `Giờ bắt đầu (${st}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
            );
          }
          if (et && !this.isTimeInShiftRange(et, shift.startTime, shift.endTime)) {
            throw ApiError.badRequest(
              `Giờ kết thúc (${et}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
            );
          }
        }
      }
    }

    // 2. Perform Slot update
    const patch: GenericRecord = { ...payload, updatedAt: new Date().toISOString() };
    if (payload.shiftDate) {
      patch.shiftDate = toUTCMidnight(payload.shiftDate);
    }
    if (payload.assignedUserIds) patch.assignedUserIds = normalizeIdList(payload.assignedUserIds);

    const updated = await dutySlotsRepository.update(slotId, patch);

    // 3. Synchronize capacity and times with parent Kip if changed
    if (slot.kipId) {
      const kipUpdate: GenericRecord = { updatedAt: new Date().toISOString() };
      let changed = false;

      if (payload.capacity !== undefined) {
        kipUpdate.capacity = Number(payload.capacity);
        changed = true;
      }

      if (payload.startTime !== undefined) {
        kipUpdate.startTime = payload.startTime;
        changed = true;
      }
      if (payload.endTime !== undefined) {
        kipUpdate.endTime = payload.endTime;
        changed = true;
      }

      if (changed) {
        await dutyKipsRepository.update(slot.kipId, kipUpdate);
      }
    }

    // --- LOGGING ---
    const label = await this.getSlotLabel(slot);
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: normalizeId(performerId), // Use performer as target if general update
      performerId: normalizeId(performerId),
      details: `Admin cập nhật thông tin kíp trực: ${label}`,
      createdAt: new Date(),
    });

    return updated;
  }

  async registerToSlot(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');
    if (slot.status === 'locked') throw ApiError.badRequest('Locked');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (assigned.some((id) => String(id) === String(userId))) {
      return slot;
    }

    // --- CONFLICT CHECK (From HEAD) ---
    const sameDateSlots = await dutySlotsRepository.findMany({ shiftDate: slot.shiftDate });
    const hasConflict = sameDateSlots.some((item: any) => {
      if (normalizeId(item.id) === normalizeId(slot.id)) return false;
      const itemAssigned = normalizeIdList(item.assignedUserIds || []);
      if (!itemAssigned.includes(userId)) return false;
      return (item.startTime || '') === (slot.startTime || '') && (item.endTime || '') === (slot.endTime || '');
    });

    if (hasConflict) {
      throw ApiError.badRequest('Bạn đã có lịch trực khác vào thời gian này.');
    }

    // --- WEEKLY LIMIT CHECK ---
    const settings = await this.getSettings();
    const weeklyLimit = settings.weeklyKipLimit;
    if (weeklyLimit !== null && weeklyLimit !== undefined && Number(weeklyLimit) > 0) {
      const weekStartStr = new Date(slot.weekStart).toISOString();
      const allSlotsInWeek = await dutySlotsRepository.findMany({
        weekStart: weekStartStr,
      });

      const userTotalInWeek = allSlotsInWeek.filter((s: any) => {
        const ids = normalizeIdList(s.assignedUserIds || []);
        return ids.includes(userId);
      }).length;

      if (userTotalInWeek >= settings.weeklyKipLimit) {
        throw ApiError.badRequest(`Bạn đã đạt giới hạn đăng ký trong tuần (${settings.weeklyKipLimit} kíp).`);
      }
    }

    // --- REDUNDANT CHECK ---
    const currentSlot = await dutySlotsRepository.findById(slot.id);
    if (!currentSlot) throw ApiError.notFound('Slot not found');

    const currentAssigned = normalizeIdList(currentSlot.assignedUserIds || []);
    if (currentAssigned.includes(userId)) return currentSlot;

    // Get capacity: prioritize slot override, fallback to Kip template
    let maxCapacity = Number(currentSlot.capacity);
    if (!maxCapacity || isNaN(maxCapacity)) {
      const kip = await dutyKipsRepository.findById(currentSlot.kipId);
      maxCapacity = Number(kip?.capacity) || 1;
    }

    if (currentAssigned.length >= maxCapacity) {
      throw ApiError.badRequest('Ca trực đã đầy, vui lòng chọn kíp khác.');
    }

    // Role-based Quota Check (Granular Allocation)
    const slotStructure = currentSlot.slotStructure || [];
    if (slotStructure.length > 0) {
      // 1. Get user's position
      const fullUser = typeof user === 'object' ? user : await usersRepository.findById(userId);
      const userPosition = fullUser?.position;

      // 2. Find if user belongs to a requirement group
      const requirement = slotStructure.find(
        (req: any) => Array.isArray(req.positions) && req.positions.includes(userPosition),
      );

      if (requirement) {
        // Count occupants in the same requirement group
        const assignedUsers = await usersRepository.findMany({ id_in: currentAssigned });
        const occupantsInGroup = assignedUsers.filter(
          (u: any) => Array.isArray(requirement.positions) && requirement.positions.includes(u.position),
        ).length;

        if (occupantsInGroup >= requirement.slots) {
          throw ApiError.badRequest(`Hết chỗ cho vị trí '${requirement.label}' (${requirement.slots} slot).`);
        }
      } else {
        // User not in any structured group.
        // Check "Residual Capacity": Total - Sum of all structured quotas
        const totalStructuredSlots = slotStructure.reduce((acc: number, req: any) => acc + (Number(req.slots) || 0), 0);
        const freeSlotsTotal = maxCapacity - totalStructuredSlots;

        const assignedUsers = await usersRepository.findMany({ id_in: currentAssigned });
        const structuredUserIds = new Set();
        slotStructure.forEach((req: any) => {
          assignedUsers.forEach((u: any) => {
            if (Array.isArray(req.positions) && req.positions.includes(u.position)) {
              structuredUserIds.add(u.id);
            }
          });
        });

        const unmappedOccupants = currentAssigned.length - structuredUserIds.size;
        if (unmappedOccupants >= freeSlotsTotal && freeSlotsTotal >= 0) {
          throw ApiError.badRequest(
            'Hết chỗ cho vị trí của bạn (Các chỗ còn lại đã được dành riêng cho chức vụ khác).',
          );
        }
      }
    }

    const updated = await dutySlotsRepository.update(currentSlot.id, {
      assignedUserIds: [...currentAssigned, userId].map(Number),
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Đăng ký kíp trực thành công',
      message: `Bạn đã đăng ký: ${slot.shiftLabel} ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}`,
      category: 'shift',
      type: 'shift',
      refId: slot.id,
    });

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'assign',
      slotId: normalizeId(slot.id),
      userId: normalizeId(userId),
      performerId: normalizeId(userId),
      details: `Đăng ký kíp trực: ${slot.shiftLabel}.`,
      createdAt: new Date(),
    });

    return updated;
  }

  async cancelRegistration(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp trực không tồn tại');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (!assigned.includes(userId)) {
      throw ApiError.badRequest('Bạn không đăng ký kíp trực này');
    }

    const settings = await this.getSettings();
    const isAdmin = typeof user === 'object' && (user as any).role === 'admin';
    const isFull = assigned.length >= (slot.capacity || 1);

    if (!settings.allowUnregisterWhenFull && isFull && !isAdmin) {
      throw ApiError.badRequest('Kíp đã đủ người, không thể tự ý hủy. Hãy liên hệ Admin.');
    }

    const updated = await dutySlotsRepository.update(slot.id, {
      assignedUserIds: assigned.filter((id) => id !== userId),
      updatedAt: new Date().toISOString(),
    });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'cancel',
      slotId: normalizeId(slotId),
      userId,
      performerId: userId,
      details: `Hủy đăng ký kíp: ${slot.shiftLabel}.`,
      createdAt: new Date(),
    });

    return updated;
  }

  async requestSwap(payload: GenericRecord, requesterUser: GenericRecord) {
    const toSlotId = normalizeId(payload.slotId || payload.dutySlotId || payload.toSlotId);
    const fromSlotId = normalizeId(payload.fromSlotId);
    const targetUserId = payload.targetUserId ? normalizeId(payload.targetUserId) : null;

    const toSlot = await dutySlotsRepository.findById(toSlotId);
    if (!toSlot) throw ApiError.notFound('Mục tiêu chuyển kíp không tồn tại');

    const created = await dutySwapRequestsRepository.create({
      dutySlotId: toSlotId,
      fromSlotId: fromSlotId,
      requesterId: normalizeId(requesterUser.id),
      targetUserId: targetUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (targetUserId) {
      // Notification for mutual swap/replacement
      await notificationService.notifyUser(targetUserId, {
        title: 'Yêu cầu đổi ca trực',
        message: `${requesterUser.name} muốn đổi ca với bạn: ${toSlot.shiftLabel}`,
        category: 'swap',
        type: 'swap',
        refId: created.id,
      });
    } else {
      // General transfer request (Notify Admin)
      const admins = await usersRepository.findMany({ role: 'admin' });
      for (const admin of admins) {
        await notificationService.notifyUser(admin.id as number, {
          title: 'Yêu cầu chuyển ca trực',
          message: `${requesterUser.name} xin chuyển sang: ${toSlot.shiftLabel}`,
          category: 'approval',
          type: 'approval',
          refId: created.id,
        });
      }
    }

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'swap_transfer',
      action: 'request',
      requestId: normalizeId(created.id),
      slotId: normalizeId(toSlotId),
      userId: normalizeId(requesterUser.id),
      performerId: normalizeId(requesterUser.id),
      details: `Yêu cầu đổi/chuyển kíp: ${toSlot.shiftLabel}. ${fromSlotId ? `Từ kíp #${fromSlotId}` : 'Chuyển mới'}.`,
      createdAt: new Date(),
    });

    return created;
  }

  async decideSwap(requestId: Identifier, payload: GenericRecord = {}, approver: any) {
    const req = await dutySwapRequestsRepository.findById(requestId);
    if (!req) throw ApiError.notFound('Yêu cầu không tồn tại');

    const status = payload.status || payload.decision;
    const approverId = normalizeId(approver?.id || approver);
    const approverObj =
      typeof approver === 'object' && approver.role ? approver : await usersRepository.findById(approverId);
    if (!approverObj) throw ApiError.notFound('Người duyệt không tồn tại');

    // Permission check: Admin/Staff can always decide. TargetUser can also decide (Accept/Reject).
    const isTargetUser = normalizeId(req.targetUserId) === approverId;
    const isAdminOrStaff = ['admin', 'staff'].includes(approverObj.role as string);

    if (!isTargetUser && !isAdminOrStaff) {
      throw ApiError.forbidden('Bạn không có quyền xử lý yêu cầu này');
    }

    if (status === 'approved') {
      const targetSlot = await dutySlotsRepository.findById(req.dutySlotId);
      if (!targetSlot) throw ApiError.notFound('Kíp trực đích không tồn tại');

      // 1. Remove from source slot (if any)
      if (req.fromSlotId) {
        const sourceSlot = await dutySlotsRepository.findById(req.fromSlotId);
        if (sourceSlot) {
          const sourceAssigned = normalizeIdList(sourceSlot.assignedUserIds || []);
          await dutySlotsRepository.update(sourceSlot.id, {
            assignedUserIds: sourceAssigned.filter((id) => normalizeId(id) !== normalizeId(req.requesterId)),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      // 2. Add to target slot
      const targetAssigned = normalizeIdList(targetSlot.assignedUserIds || []);
      if (!targetAssigned.includes(normalizeId(req.requesterId))) {
        targetAssigned.push(normalizeId(req.requesterId));
      }

      await dutySlotsRepository.update(targetSlot.id, {
        assignedUserIds: targetAssigned,
        updatedAt: new Date().toISOString(),
      });

      // --- LOGGING ---
      const targetLabel = await this.getSlotLabel(targetSlot);
      await dutyLogsRepository.create({
        type: 'swap_transfer',
        action: 'transfer',
        requestId: normalizeId(requestId),
        slotId: targetSlot.id,
        userId: req.requesterId,
        performerId: approverId,
        details: `Điều chuyển nhân sự: ${req.requesterId}. Lộ trình: ${req.fromSlotId ? `Kíp #${req.fromSlotId}` : 'N/A'} -> ${targetLabel} (#${targetSlot.id})`,
        createdAt: new Date(),
      });

      // Notifications
      await notificationService.notifyUser(req.requesterId as number, {
        title: 'Điều chuyển kíp trực thành công',
        message: `Bạn đã được điều chuyển sang kíp trực: ${targetLabel}.`,
        category: 'duty',
        type: 'swap',
        refId: req.id,
      });
    } else if (status === 'rejected') {
      // Notify the requester about rejection
      await notificationService.notifyUser(req.requesterId as number, {
        title: 'Yêu cầu đổi ca bị từ chối',
        message: `Yêu cầu đổi ca của bạn đã được từ chối.`,
        category: 'duty',
        type: 'swap',
        refId: req.id,
      });

      // --- LOGGING ---
      await dutyLogsRepository.create({
        type: 'swap_transfer',
        action: 'rejected',
        requestId: normalizeId(requestId),
        slotId: normalizeId(req.dutySlotId),
        userId: normalizeId(req.requesterId),
        performerId: normalizeId(approverId),
        details: `Từ chối yêu cầu đổi/chuyển kíp của nhân sự: ${req.requesterId}.`,
        createdAt: new Date(),
      });
    }

    return await dutySwapRequestsRepository.update(requestId, {
      status,
      approvedBy: approverId,
      decisionNote: payload.reason || payload.decisionNote || '',
      updatedAt: new Date().toISOString(),
    });
  }

  async markAttendance(slotId: Identifier, userIds: Identifier[], performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const updated = await dutySlotsRepository.update(slotId, { attendedUserIds: userIds });

    // --- LOGGING ---
    const label = await this.getSlotLabel(slot);
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: normalizeId(performerId), // Admin responsible for this bulk action
      performerId: normalizeId(performerId),
      details: `Điểm danh cho kíp: ${label}. Danh sách người có mặt: ${userIds.join(', ')}`,
      createdAt: new Date(),
    });

    return updated;
  }

  async requestLeave(slotId: Identifier, userId: Identifier, reason: string) {
    return await dutyLeaveRequestsRepository.create({
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
      reason,
      status: 'pending',
    });
  }

  async createLeaveManual(data: GenericRecord, performerId: Identifier) {
    const { userId, slotId, reason, status = 'pending', rejectionReason = '' } = data;

    const request = await dutyLeaveRequestsRepository.create({
      userId: normalizeId(userId),
      slotId: normalizeId(slotId),
      reason: reason || 'Admin tạo thủ công',
      status,
      rejectionReason,
      approvedBy: status === 'approved' ? normalizeId(performerId) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Nếu status là approved, thực hiện luôn logic gỡ nhân sự
    if (status === 'approved') {
      await this.resolveLeaveRequest(request.id, 'approved', performerId, rejectionReason);
    }

    return request;
  }

  async updateLeaveRequest(id: Identifier, data: GenericRecord, performerId: Identifier) {
    const old = await dutyLeaveRequestsRepository.findById(id);
    if (!old) throw ApiError.notFound('Mục không tồn tại');

    const updated = await dutyLeaveRequestsRepository.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    // Nếu trạng thái thay đổi sang approved mà trước đó chưa approved
    if (data.status === 'approved' && old.status !== 'approved') {
      await this.resolveLeaveRequest(id, 'approved', performerId, data.rejectionReason || '');
    }

    return updated;
  }

  async deleteLeaveRequest(id: Identifier) {
    return await dutyLeaveRequestsRepository.delete(id);
  }

  async getLeaveRequests(options: GenericRecord = {}) {
    const result = await dutyLeaveRequestsRepository.findAllAdvanced({
      ...options,
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
    });

    const users = await usersRepository.findAll();
    const userMap = new Map(
      (users as any[]).map((u) => [normalizeId(u.id), { id: u.id, name: u.name, avatar: u.avatar }]),
    );

    const slots = await dutySlotsRepository.findAll();
    const slotMap = new Map((slots as any[]).map((s) => [normalizeId(s.id), s]));

    const data = result.data.map((req: any) => ({
      ...req,
      user: userMap.get(normalizeId(req.userId)),
      slot: slotMap.get(normalizeId(req.slotId)),
    }));

    return { ...result, data };
  }

  async resolveLeaveRequest(
    requestId: Identifier,
    status: string,
    approverId: Identifier,
    rejectionReason: string = '',
  ) {
    const request = await dutyLeaveRequestsRepository.findById(requestId);
    if (!request) throw ApiError.notFound('Đơn xin nghỉ không tồn tại');

    const now = new Date().toISOString();
    const updated = await dutyLeaveRequestsRepository.update(requestId, {
      status,
      approvedBy: normalizeId(approverId),
      rejectionReason,
      updatedAt: now,
    });

    if (status === 'approved') {
      const slot = await dutySlotsRepository.findById(request.slotId);
      if (slot) {
        const assigned = normalizeIdList(slot.assignedUserIds || []);
        const nextAssigned = assigned.filter((id) => normalizeId(id) !== normalizeId(request.userId));
        await dutySlotsRepository.update(slot.id, {
          assignedUserIds: nextAssigned,
          updatedAt: now,
        });

        // --- LOGGING ---
        const label = await this.getSlotLabel(slot);
        await dutyLogsRepository.create({
          type: 'leave',
          action: 'approved',
          requestId: normalizeId(requestId),
          slotId: slot.id,
          userId: request.userId,
          performerId: normalizeId(approverId),
          details: `Duyệt đơn nghỉ kíp: ${label || slot.id}`,
          createdAt: new Date(),
        });

        // Notify member
        await notificationService.notifyUser(request.userId as number, {
          title: 'Đơn xin nghỉ đã được duyệt',
          message: `Yêu cầu xin nghỉ cho kíp ${label || ''} của bạn đã được chấp thuận.`,
          category: 'duty',
          type: 'leave',
          refId: request.id,
        });
      }
    } else if (status === 'rejected') {
      // --- LOGGING ---
      await dutyLogsRepository.create({
        type: 'leave',
        action: 'rejected',
        requestId: normalizeId(requestId),
        slotId: request.slotId,
        userId: request.userId,
        performerId: normalizeId(approverId),
        details: `Từ chối đơn nghỉ. Lý do: ${rejectionReason || 'Không có'}`,
        createdAt: new Date(),
      });

      await notificationService.notifyUser(request.userId as number, {
        title: 'Đơn xin nghỉ bị từ chối',
        message: `Yêu cầu xin nghỉ của bạn đã bị từ chối. Lý do: ${rejectionReason || 'Không có'}`,
        category: 'duty',
        type: 'leave',
        refId: request.id,
      });
    }

    return updated;
  }

  async getStats() {
    const slots = (await dutySlotsRepository.findAll()) || [];
    const leaves = (await dutyLeaveRequestsRepository.findAll()) || [];
    const swaps = (await dutySwapRequestsRepository.findAll()) || [];

    return {
      global: {
        total: slots.length,
        open: slots.filter((s: any) => s.status === 'open').length,
        locked: slots.filter((s: any) => s.status === 'locked').length,
        totalAssigned: slots.reduce((acc: number, s: any) => acc + (s.assignedUserIds?.length || 0), 0),
      },
      requests: {
        leavePending: leaves.filter((r: any) => r.status === 'pending').length,
        leaveApproved: leaves.filter((r: any) => r.status === 'approved').length,
        leaveRejected: leaves.filter((r: any) => r.status === 'rejected').length,
        swapPending: swaps.filter((r: any) => r.status === 'pending').length,
        swapApproved: swaps.filter((r: any) => r.status === 'approved').length,
      },
    };
  }

  // ==================== TEMPLATE ASSIGNMENT ====================

  async getTemplateAssignments() {
    return await dutyTemplateAssignmentsRepository.findAll();
  }

  async createTemplateAssignment(data: any, actorId: any) {
    const startDate = toUTCMidnight(data.startDate);
    const endDate = dayjs.utc(data.endDate).endOf('day').toDate();
    const templateId = parseInt(data.templateId, 10);
    const mode = data.mode || 'kips';
    const jobId = data.jobId;

    if (jobId) {
      socketService.emitToRoom(jobId, 'job_progress', { percent: 5, text: 'Đang phân tích cấu trúc Bản mẫu...' });
    }

    // 1. Fetch all shifts for this template
    const shifts = await this.getShiftTemplates(templateId);
    if (!shifts || shifts.length === 0) {
      throw ApiError.badRequest('Bản mẫu này không có ca trực nào để áp dụng.');
    }

    // 2. Prepare array of dates
    let current = dayjs.utc(startDate).startOf('day');
    const end = dayjs.utc(endDate).startOf('day');
    const datesToInit: string[] = [];

    while (current.isSameOrBefore(end, 'day')) {
      datesToInit.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    const results: any[] = [];

    // 3. Process concurrently in chunks (Batch Size: 15 days) to avoid DB overload
    // By grouping by date, we guarantee NO race conditions on dayRecords.
    const BATCH_SIZE = 15;
    const totalDays = datesToInit.length;
    for (let i = 0; i < totalDays; i += BATCH_SIZE) {
      if (jobId) {
        const percent = Math.floor(10 + (i / totalDays) * 85); // 10% -> 95%
        socketService.emitToRoom(jobId, 'job_progress', {
          percent,
          text: `Đang xử lý dữ liệu từ ngày ${dayjs(datesToInit[i]).format('DD/MM')}...`,
        });
      }

      const batchDates = datesToInit.slice(i, i + BATCH_SIZE);
      const batchPromises = batchDates.map(async (dateStr) => {
        const dIdx = (dayjs.utc(dateStr).day() + 6) % 7; // Mon=0...Sun=6
        const localResults: any[] = [];

        for (const s of shifts as any[]) {
          const shiftDays = s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
          if (shiftDays.includes(dIdx)) {
            // Sequentially add shifts for THIS specific day to prevent row overwrites
            await this.stampTemplateShift(dateStr, s.id, actorId, mode);
            localResults.push({ date: dateStr, shiftId: s.id });
          }
        }
        return { localResults };
      });

      const chunkResults = await Promise.all(batchPromises);
      for (const res of chunkResults) {
        results.push(...res.localResults);
      }
    }

    if (jobId) {
      socketService.emitToRoom(jobId, 'job_progress', { percent: 100, text: 'Hoàn tất chiến dịch lập lịch.' });
    }

    return { success: true, results };
  }

  async addShiftToDay(
    date: string,
    shiftTemplateId: number,
    actorId: Identifier,
    overrides: any = null,
    mode: string = 'kips',
    batchMode: boolean = false,
  ) {
    const d = toUTCMidnight(date);
    const isoDate = d.toISOString();

    const actualShift = await this.stampTemplateShift(isoDate, shiftTemplateId, actorId);
    if (!actualShift) throw ApiError.badRequest('Không thể tạo ca từ bản mẫu này');

    // If there are overrides (e.g. name, time), update the instance
    if (overrides) {
      await dutyShiftsRepository.update(actualShift.id, {
        name: overrides.name || actualShift.name,
        startTime: overrides.startTime || actualShift.startTime,
        endTime: overrides.endTime || actualShift.endTime,
      });
    }

    // Fetch slots created by stampTemplateShift
    const kips = await dutyKipsRepository.findMany({ shiftId: actualShift.id });
    const kipIds = kips.map((k) => k.id);
    const slots = await dutySlotsRepository.findMany({
      kipId: { $in: kipIds },
    });

    return { success: true, slots };
  }

  async createSwapManual(data: GenericRecord, performerId: Identifier) {
    const { requesterId, fromSlotId, dutySlotId, status = 'pending', reason = '' } = data;

    const request = await dutySwapRequestsRepository.create({
      requesterId: normalizeId(requesterId),
      fromSlotId: normalizeId(fromSlotId) || null,
      dutySlotId: normalizeId(dutySlotId),
      status,
      reason,
      approvedBy: status === 'approved' ? normalizeId(performerId) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (status === 'approved') {
      await this.decideSwap(request.id, { decision: 'approved', reason }, performerId);
    }

    return request;
  }

  async updateSwapRequest(id: Identifier, data: GenericRecord, performerId: Identifier) {
    const old = await dutySwapRequestsRepository.findById(id);
    if (!old) throw ApiError.notFound('Mục không tồn tại');

    const updated = await dutySwapRequestsRepository.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (data.status === 'approved' && old.status !== 'approved') {
      await this.decideSwap(id, { decision: 'approved', reason: data.reason || '' }, performerId);
    }

    return updated;
  }

  async deleteSwapRequest(id: Identifier) {
    return await dutySwapRequestsRepository.delete(id);
  }

  async getSwapRequests(user: GenericRecord, options: GenericRecord = {}) {
    const userId = normalizeId(user.id);
    const isApprover = ['admin', 'staff'].includes(user.role);

    const result = await dutySwapRequestsRepository.findAllAdvanced({
      ...options,
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
      filter: isApprover
        ? options.filter
        : {
            ...options.filter,
            $or: [{ requesterId: userId }, { targetUserId: userId }],
          },
    });

    const users = await usersRepository.findAll();
    const userMap = new Map(
      (users as any[]).map((u) => [normalizeId(u.id), { id: u.id, name: u.name, avatar: u.avatar }]),
    );

    const slots = await dutySlotsRepository.findAll();
    const slotMap = new Map((slots as any[]).map((s) => [normalizeId(s.id), s]));

    const data = result.data.map((req: any) => ({
      ...req,
      requester: userMap.get(normalizeId(req.requesterId)),
      targetUser: userMap.get(normalizeId(req.targetUserId)),
      slot: slotMap.get(normalizeId(req.dutySlotId)),
    }));

    return { ...result, data };
  }

  async removeShiftFromDay(_date: string, shiftInstanceId: number) {
    const shift = await dutyShiftsRepository.findById(shiftInstanceId);
    if (!shift) throw ApiError.notFound('Ca thực tế không tồn tại');

    // 1. Find all kips belonging to this shift
    const kips = await dutyKipsRepository.findMany({ shiftId: shift.id });

    // 2. For each kip, delete its slots and associated requests, then delete the kip
    for (const kip of kips) {
      const kipSlots = await dutySlotsRepository.findMany({ kipId: kip.id });
      const kipSlotIds = kipSlots.map((s) => s.id);

      if (kipSlotIds.length > 0) {
        await dutySwapRequestsRepository.deleteMany({ dutySlotId: { $in: kipSlotIds } });
        await dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: kipSlotIds } });
        await dutySlotsRepository.deleteMany({ kipId: kip.id });
      }

      await dutyKipsRepository.delete(kip.id);
    }

    // 3. Delete any orphan slots directly linked to shiftId
    const orphanSlots = await dutySlotsRepository.findMany({ shiftId: shift.id });
    const orphanSlotIds = orphanSlots.map((s) => s.id);
    if (orphanSlotIds.length > 0) {
      await dutySwapRequestsRepository.deleteMany({ dutySlotId: { $in: orphanSlotIds } });
      await dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: orphanSlotIds } });
      await dutySlotsRepository.deleteMany({ shiftId: shift.id });
    }

    // 4. Delete the shift instance itself
    await dutyShiftsRepository.delete(shift.id);

    return { success: true };
  }

  async updateActualShift(shiftId: number, data: GenericRecord) {
    const shift = await dutyShiftsRepository.findById(shiftId);
    if (!shift) throw ApiError.notFound('Ca thực tế không tồn tại');

    const updated = await dutyShiftsRepository.update(shiftId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    return updated;
  }

  async deleteActualKip(kipId: number) {
    const kip = await dutyKipsRepository.findById(kipId);
    if (!kip) throw ApiError.notFound('Kíp thực tế không tồn tại');

    // 1. Find and delete all slots of this kip, including their associated requests
    const slots = await dutySlotsRepository.findMany({ kipId: kip.id });
    const slotIds = slots.map((s) => s.id);

    if (slotIds.length > 0) {
      await dutySwapRequestsRepository.deleteMany({ dutySlotId: { $in: slotIds } });
      await dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: slotIds } });
      await dutySlotsRepository.deleteMany({ kipId: kip.id });
    }

    // 2. Delete the kip
    await dutyKipsRepository.delete(kip.id);

    return { success: true };
  }

  async updateTemplateAssignment(id: any, data: any) {
    const update: any = { updatedAt: new Date().toISOString() };
    if (data.startDate) update.startDate = new Date(data.startDate).toISOString();
    if (data.endDate) update.endDate = new Date(data.endDate).toISOString();
    if (data.templateId) update.templateId = parseInt(data.templateId, 10);
    if (data.note !== undefined) update.note = data.note;

    return await dutyTemplateAssignmentsRepository.update(id, update);
  }

  async deleteTemplateAssignment(id: any) {
    return await dutyTemplateAssignmentsRepository.delete(id);
  }
}

export default new DutyService();
