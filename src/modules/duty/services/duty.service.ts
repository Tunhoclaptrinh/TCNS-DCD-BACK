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
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import db from '@database';
import ApiError from '@utils/api-error';
import notificationService from '@modules/notifications/services/notification.service';

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
  // Extract YYYY-MM-DD and force to UTC 00:00:00.000
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

  buildScheduleUserMap(users: DutyUser[]) {
    return new Map(users.map((user) => [normalizeId(user.id), user]));
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
    const title = action === 'register' ? 'Đăng ký ca trực thành công' : 'Hủy ca trực thành công';
    const message =
      action === 'register'
        ? `Bạn đã đăng ký ca '${slot.shiftLabel}' ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}.`
        : `Bạn đã hủy ca '${slot.shiftLabel}' ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}.`;

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
    const shifts = await dutyShiftsRepository.findByTemplateId(normalizeId(id));
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

    const shifts = await dutyShiftsRepository.findMany(filter);
    const kips = await dutyKipsRepository.findAll();
    return shifts
      .map((shift: any) => ({
        ...shift,
        kips: kips
          .filter((k: any) => normalizeId(k.shiftId) === normalizeId(shift.id))
          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
      }))
      .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  async createShiftTemplate(data: GenericRecord) {
    return await dutyShiftsRepository.create({
      templateId: data.templateId ? normalizeId(data.templateId) : null,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isSpecialEvent: !!data.isSpecialEvent,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    });
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
    return await dutyShiftsRepository.update(id, {
      templateId: data.templateId ? normalizeId(data.templateId) : undefined,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isSpecialEvent: data.isSpecialEvent !== undefined ? !!data.isSpecialEvent : undefined,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : undefined,
    });
  }

  async deleteShiftTemplate(id: Identifier) {
    await dutyKipsRepository.deleteByShiftId(normalizeId(id));
    return await dutyShiftsRepository.delete(id);
  }

  async createKipTemplate(data: GenericRecord) {
    return await dutyKipsRepository.create({
      shiftId: normalizeId(data.shiftId),
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
      description: data.description || '',
    });
  }

  async updateKipTemplate(id: Identifier, data: GenericRecord) {
    return await dutyKipsRepository.update(id, {
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
      description: data.description || '',
    });
  }

  async deleteKipTemplate(id: Identifier) {
    return await dutyKipsRepository.delete(id);
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
    we.setUTCDate(we.getUTCDate() + 6); // End of the week

    // Check for existing slots
    const existingSlots = await dutySlotsRepository.findMany({
      shiftDate_gte: ws.toISOString(),
      shiftDate_lte: we.toISOString(),
    });
    if (existingSlots.length > 0) throw ApiError.badRequest('Schedule already exists for this week');

    // Fetch all assignments that might overlap with this week
    const assignments = await dutyTemplateAssignmentsRepository.findMany({
      startDate_lte: we.toISOString(),
      endDate_gte: ws.toISOString(),
    });

    const defaultGroup = await dutyTemplatesRepository.findDefault();

    const allWeeklySlots = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startIso);
      d.setUTCDate(d.getUTCDate() + i);
      const isoDate = d.toISOString();

      // Find assignment for this specific day
      const assignment = assignments.find((a: any) => {
        const start = new Date(a.startDate);
        const end = new Date(a.endDate);
        return d >= start && d <= end;
      });

      const groupId = assignment?.templateId || defaultGroup?.id;
      if (!groupId) continue;

      const shifts = await dutyShiftsRepository.findByTemplateId(normalizeId(groupId));

      for (const shift of shifts) {
        const res = await this.addShiftToDay(isoDate, shift.id, actorId, null, 'kips', true);
        if (res.slots) allWeeklySlots.push(...res.slots);
      }
    }

    if (allWeeklySlots.length > 0) {
      await dutySlotsRepository.insertMany(allWeeklySlots);
    }

    return { success: true };
  }

  async generateDaySlots(date: string, actorId: Identifier) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const isoDate = d.toISOString();
    const dayOfWeek = (d.getUTCDay() + 6) % 7;
    const weekStartIso = getWeekStartISO(isoDate);

    const dayRecord = await this.findOrCreateDay(isoDate, actorId);
    const shifts = await this.getShiftTemplates();
    const slots = [];

    for (const shift of shifts as any[]) {
      for (const kip of shift.kips) {
        const days = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        if (!days.includes(dayOfWeek)) continue;

        slots.push(
          this.buildSlotPayload(
            {
              weekStart: weekStartIso,
              shiftDate: isoDate,
              dayId: dayRecord.id,
              shiftId: shift.id,
              kipId: kip.id,
              shiftLabel: `${shift.name} - ${kip.name}`,
              startTime: kip.startTime || shift.startTime,
              endTime: kip.endTime || shift.endTime,
              capacity: kip.capacity,
              slotStructure: kip.slotStructure || [],
              config: kip.config || {},
              note: kip.description || '',
            },
            actorId,
          ),
        );
      }
    }
    if (slots.length === 0) return [];
    return await dutySlotsRepository.insertMany(slots);
  }

  async generateRangeSlots(
    startDate: string,
    endDate: string,
    actorId: Identifier,
    templateId?: Identifier,
    mode: 'all' | 'shifts' | 'kips' = 'kips',
  ) {
    const s = toUTCMidnight(startDate);
    const e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);

    if (e < s) throw ApiError.badRequest('End date must be after start date');

    // Fetch all assignments that might overlap with this range
    const assignments = await dutyTemplateAssignmentsRepository.findMany({
      startDate_lte: e.toISOString(),
      endDate_gte: s.toISOString(),
    });

    const allSlots = [];
    let curr = new Date(s);

    while (curr <= e) {
      const isoDate = curr.toISOString();
      const dayOfWeek = (curr.getUTCDay() + 6) % 7;
      const weekStartIso = getWeekStartISO(isoDate);

      // Determine effective template for this day
      let effectiveTemplateId = templateId;
      if (!effectiveTemplateId) {
        const assignment = assignments.find(
          (a: any) =>
            dayjs.utc(isoDate).isSameOrAfter(dayjs.utc(a.startDate), 'day') &&
            dayjs.utc(isoDate).isSameOrBefore(dayjs.utc(a.endDate), 'day'),
        );
        if (assignment) {
          effectiveTemplateId = assignment.templateId;
        } else {
          const defaultTemplate = await dutyTemplatesRepository.findDefault();
          effectiveTemplateId = defaultTemplate?.id;
        }
      }

      if (!effectiveTemplateId) {
        curr.setUTCDate(curr.getUTCDate() + 1);
        continue;
      }

      const shifts = await this.getShiftTemplates(effectiveTemplateId);
      const dayRecord = await this.findOrCreateDay(isoDate, actorId);

      const persistentShiftIds: number[] = [];
      const shiftMap = new Map<number, number>(); // SourceID -> PersistentID

      // 1. Deep Copy the shifts into "Individual Records" (templateId = null)
      for (const s of shifts as any[]) {
        if (!(s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek)) continue;

        const newShift = await dutyShiftsRepository.create({
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          description: 'INSTANCE',
          templateId: null, // DISCONNECT from template group
          isSpecialEvent: !!s.isSpecialEvent,
          daysOfWeek: [dayOfWeek],
        });

        persistentShiftIds.push(newShift.id as number);
        shiftMap.set(s.id, newShift.id as number);
      }

      await dutyDaysRepository.update(dayRecord.id, {
        shiftTemplateIds: persistentShiftIds,
      });

      for (const shift of shifts as any[]) {
        if (!shiftMap.has(shift.id)) continue;
        const persistentShiftId = shiftMap.get(shift.id)!;

        // 2. Clone Kips for this shift instance
        const templateKips = await dutyKipsRepository.findMany({ shiftId: normalizeId(shift.id) });
        const kipMap = new Map<number, number>();

        for (const k of templateKips) {
          const newKip = await dutyKipsRepository.create({
            shiftId: persistentShiftId,
            name: k.name,
            coefficient: k.coefficient,
            capacity: k.capacity,
            startTime: k.startTime,
            endTime: k.endTime,
            daysOfWeek: k.daysOfWeek,
            slotStructure: k.slotStructure,
            config: k.config,
            description: 'INSTANCE',
          });
          kipMap.set(k.id as number, newKip.id as number);
        }

        // Create a Shift-level slot (kipId: null) ONLY if there are no kips for this shift
        // OR if explicitly requested via 'shifts' mode (but 'all' should only show kips if present)
        if (mode === 'shifts' || (mode === 'all' && templateKips.length === 0)) {
          allSlots.push(
            this.buildSlotPayload(
              {
                weekStart: weekStartIso,
                shiftDate: isoDate,
                dayId: dayRecord.id,
                shiftId: persistentShiftId,
                kipId: null,
                shiftLabel: shift.name,
                startTime: shift.startTime,
                endTime: shift.endTime,
                isSpecialEvent: !!shift.isSpecialEvent,
                note: shift.description || '',
              },
              actorId,
            ),
          );
        }

        if (mode === 'kips' || mode === 'all') {
          for (const kip of templateKips) {
            const kipDays = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
            if (!kipDays.includes(dayOfWeek)) continue;

            allSlots.push(
              this.buildSlotPayload(
                {
                  weekStart: weekStartIso,
                  shiftDate: isoDate,
                  dayId: dayRecord.id,
                  shiftId: persistentShiftId,
                  kipId: kipMap.get(kip.id as number),
                  shiftLabel: `${shift.name} - ${kip.name}`,
                  startTime: kip.startTime || shift.startTime,
                  endTime: kip.endTime || shift.endTime,
                  capacity: kip.capacity,
                  slotStructure: kip.slotStructure,
                  config: kip.config,
                  isSpecialEvent: !!shift.isSpecialEvent,
                  note: kip.description || kip.duration || '',
                },
                actorId,
              ),
            );
          }
        }
      }
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    if (allSlots.length === 0) return [];

    await dutySlotsRepository.deleteMany({
      shiftDate_gte: s.toISOString(),
      shiftDate_lte: e.toISOString(),
    });

    const created = await dutySlotsRepository.insertMany(allSlots);

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: 0, // Batch creation
      userId: actorId,
      performerId: normalizeId(actorId),
      details: `Admin tạo hàng loạt kíp trực (Range: ${startDate} - ${endDate}). Số lượng: ${created.length}`,
      createdAt: new Date(),
    });

    return created;
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

    const existingTarget = await dutySlotsRepository.findOne({
      shiftDate_gte: wsTarget.toISOString(),
      shiftDate_lte: weTarget.toISOString(),
    });
    if (existingTarget) throw ApiError.badRequest('Target week already has slots');

    // 1. Fetch all data for source week
    const sourceSlots = await dutySlotsRepository.findMany({
      shiftDate_gte: wsSource.toISOString(),
      shiftDate_lte: weSource.toISOString(),
    });
    if (!sourceSlots || sourceSlots.length === 0) throw ApiError.badRequest('Source week is empty');

    const sourceDays = await dutyDaysRepository.findMany({
      date_gte: wsSource.toISOString(),
      date_lte: weSource.toISOString(),
    });

    const shiftIdMap: Record<string, any> = {};
    const kipIdMap: Record<string, any> = {};

    // 2. Clone Days and their Shift/Kip instances
    for (let i = 0; i < 7; i++) {
      const srcDate = new Date(wsSource);
      srcDate.setUTCDate(srcDate.getUTCDate() + i);
      const targetDate = new Date(wsTarget);
      targetDate.setUTCDate(targetDate.getUTCDate() + i);

      const srcDay = sourceDays.find((d: any) => new Date(d.date).getTime() === srcDate.getTime());
      if (!srcDay) continue;

      const targetDay = await this.findOrCreateDay(targetDate.toISOString(), actorId);
      const oldShiftIds = srcDay.shiftTemplateIds || [];
      const newShiftIds = [];

      for (const oldShiftId of oldShiftIds) {
        const shift = await dutyShiftsRepository.findById(oldShiftId);
        if (!shift) continue;

        // If it's an instance, clone it to keep weeks independent
        if (shift.description === 'INSTANCE') {
          const newShift = await dutyShiftsRepository.create({
            ...shift,
            id: undefined,
            _id: undefined,
            templateId: shift.templateId, // Keep reference to original blueprint if any
          });
          newShiftIds.push(newShift.id as number);
          shiftIdMap[String(oldShiftId)] = newShift.id as number;

          // Also clone its kips
          const kips = await dutyKipsRepository.findMany({ shiftId: normalizeId(oldShiftId) });
          for (const k of kips) {
            const newKip = await dutyKipsRepository.create({
              ...k,
              id: undefined,
              _id: undefined,
              shiftId: newShift.id as number,
            });
            kipIdMap[String(k.id)] = newKip.id as number;
          }
        } else {
          // If it's a direct blueprint (unlikely in stencil but possible), just link it
          newShiftIds.push(oldShiftId);
          shiftIdMap[String(oldShiftId)] = oldShiftId;
        }
      }

      await dutyDaysRepository.update(targetDay.id, { shiftTemplateIds: newShiftIds });
    }

    // 3. Clone Slots with translated IDs
    const newSlots = sourceSlots.map((slot: any) => {
      const d = new Date(slot.shiftDate);
      const dayOffset = (d.getTime() - wsSource.getTime()) / (1000 * 60 * 60 * 24);
      const t = new Date(wsTarget);
      t.setUTCDate(t.getUTCDate() + Math.round(dayOffset));

      const newShiftId = shiftIdMap[String(slot.shiftId)] || slot.shiftId;
      const newKipId = kipIdMap[String(slot.kipId)] || slot.kipId;

      return this.buildSlotPayload(
        {
          ...slot,
          id: undefined,
          _id: undefined,
          weekStart: targetIso,
          shiftDate: t.toISOString(),
          shiftId: newShiftId,
          kipId: newKipId,
        },
        actorId,
      );
    });

    const created = await dutySlotsRepository.insertMany(newSlots);

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: 0,
      userId: actorId,
      performerId: normalizeId(actorId),
      details: `Admin sao chép lịch trực từ tuần ${sourceWeekStart} sang tuần ${targetWeekStart}. Số lượng kíp: ${created.length}`,
      createdAt: new Date(),
    });

    return { success: true, count: created.length };
  }

  async deleteWeeklySlots(weekStart: string) {
    const startIso = getWeekStartISO(weekStart);
    const ws = new Date(startIso);
    const we = new Date(startIso);
    we.setUTCDate(we.getUTCDate() + 6);

    // 1. Delete all slots for the week
    await dutySlotsRepository.deleteMany({
      weekStart: new Date(startIso).toISOString(),
    });

    // 2. Clear shift boundaries in duty_days
    const days = await dutyDaysRepository.findMany({
      date_gte: ws.toISOString(),
      date_lte: we.toISOString(),
    });

    for (const d of days) {
      if (d.shiftTemplateIds?.length > 0) {
        // Optional: We could also delete the actual duty_shifts records here if they are 'INSTANCE'
        // But for simplicity and safety, resetting the reference is the most important for UI
        await dutyDaysRepository.update(d.id, { shiftTemplateIds: [] });
      }
    }

    return { success: true };
  }

  async getWeeklySchedule(options: any = {}) {
    const weekStart = getWeekStartISO(options.weekStart);
    const weekEnd = getWeekEndISO(weekStart);

    const ws = new Date(weekStart);
    const we = new Date(weekEnd);

    const result = await dutySlotsRepository.findAllAdvanced({
      ...options,
      limit: 1000,
      filter: {
        ...(options.filter || {}),
        shiftDate_gte: ws,
        shiftDate_lte: we,
      },
      expand: 'kip',
      sort: options.sort || 'shiftDate,startTime',
      order: options.order || 'asc',
    });

    const users = (await usersRepository.findAll()) as DutyUser[];
    const userMap = this.buildScheduleUserMap(users);

    const data = result.data.map((slot: any) => {
      const assignedIds = normalizeIdList(slot.assignedUserIds || []);
      return {
        ...slot,
        assignedUserIds: assignedIds,
        assignedUsers: assignedIds
          .map((id) => userMap.get(id))
          .filter(Boolean)
          .map((user: any) => ({ id: user.id, name: user.name, role: user.role, avatar: user.avatar })),
      };
    });

    // Fetch assignments that overlap with this week
    // Fetch assignments and days with a generous +/- 1 day buffer to handle timezone-shifted dates
    const queryStart = dayjs.utc(weekStart).subtract(1, 'day').toDate();
    const queryEnd = dayjs.utc(weekEnd).add(1, 'day').toDate();

    const assignments = await dutyTemplateAssignmentsRepository.findMany({
      startDate_lte: queryEnd,
      endDate_gte: queryStart,
    });

    const days = await dutyDaysRepository.findMany({
      date_gte: queryStart,
      date_lte: queryEnd,
    });

    // 3. Fetch full metadata for all referred shifts and kips (True Snapshot rendering)
    const referredShiftIds = new Set<Identifier>();
    result.data.forEach((s: any) => {
      if (s.shiftId) referredShiftIds.add(normalizeId(s.shiftId));
    });
    days.forEach((d: any) => {
      (d.shiftTemplateIds || []).forEach((id: any) => referredShiftIds.add(normalizeId(id)));
    });

    const fullShifts = await dutyShiftsRepository.findMany({ id_in: Array.from(referredShiftIds) });
    const allKips = await dutyKipsRepository.findMany({ shiftId_in: Array.from(referredShiftIds) });

    const templateData = fullShifts.map((s: any) => ({
      ...s,
      kips: allKips
        .filter((k: any) => normalizeId(k.shiftId) === normalizeId(s.id))
        .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
    }));

    return {
      success: true,
      data: {
        slots: data,
        days,
        assignments,
        templates: templateData,
      },
      weekStart,
      weekEnd,
      pagination: result.pagination,
    };
  }

  async createSlot(payload: GenericRecord, actorId: Identifier) {
    if (!payload?.shiftDate) throw ApiError.badRequest('shiftDate is required');

    const dayRecord = await this.findOrCreateDay(payload.shiftDate, actorId);

    // Auto-stamp development: If shiftId is provided, Deep Copy it if it's from a template
    let finalShiftId = payload.shiftId ? normalizeId(payload.shiftId) : null;
    if (finalShiftId) {
      const existingIds = dayRecord.shiftTemplateIds || [];
      if (!existingIds.map(String).includes(String(finalShiftId))) {
        const shiftTemplate = await dutyShiftsRepository.findById(finalShiftId);
        // Only deep copy if it's currently linked to a template
        if (shiftTemplate && shiftTemplate.templateId) {
          const newShift = await dutyShiftsRepository.create({
            name: shiftTemplate.name,
            startTime: shiftTemplate.startTime,
            endTime: shiftTemplate.endTime,
            templateId: null, // DISCONNECT
            description: 'INSTANCE',
            isSpecialEvent: !!shiftTemplate.isSpecialEvent,
            daysOfWeek: shiftTemplate.daysOfWeek,
          });
          finalShiftId = newShift.id;
        }

        if (!existingIds.map(String).includes(String(finalShiftId))) {
          await dutyDaysRepository.update(dayRecord.id, {
            shiftTemplateIds: [...existingIds, finalShiftId],
          });
        }
      }
    }

    const data = this.buildSlotPayload({ ...payload, dayId: dayRecord.id, shiftId: finalShiftId }, actorId);
    const created = await dutySlotsRepository.create(data);

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: created.id,
      userId: actorId, // In this case, the actor is the one created/assigned? Or just log the action.
      performerId: actorId,
      details: `Admin tạo kíp trực mới: ${created.shiftLabel}`,
      createdAt: new Date(),
    });

    return created;
  }

  async deleteSlot(id: Identifier, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(id);
    if (!slot) throw ApiError.notFound('Slot not found');

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'unassigned',
      action: 'removed',
      slotId: normalizeId(id),
      userId: performerId, // We just know it's deleted
      performerId: normalizeId(performerId),
      details: `Admin xóa kíp trực: ${slot.shiftLabel} ngày ${new Date(slot.shiftDate).toLocaleDateString()}`,
      createdAt: new Date(),
    });

    // Simplified: Delete ONLY the requested slot, no cascading
    await dutySlotsRepository.delete(id);

    return { success: true };
  }

  async deleteShiftSlots(date: string, shiftId: number, performerId: Identifier) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const deletedCount = await dutySlotsRepository.deleteMany({ shiftDate: d, shiftId: Number(shiftId) });

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'unassigned',
      action: 'removed',
      slotId: normalizeId(shiftId),
      userId: performerId,
      performerId: normalizeId(performerId),
      details: `Admin xóa tất cả kíp của ca ID ${shiftId} ngày ${date}`,
      createdAt: new Date(),
    });

    return deletedCount;
  }

  async updateSlot(slotId: Identifier, payload: GenericRecord = {}, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const patch: GenericRecord = { ...payload, updatedAt: new Date().toISOString() };
    if (payload.shiftDate || payload.weekStart) {
      const sDate = payload.shiftDate ? new Date(payload.shiftDate) : new Date(slot.shiftDate);
      sDate.setUTCHours(0, 0, 0, 0);
      patch.shiftDate = sDate;
      patch.weekStart = new Date(getWeekStartISO(payload.weekStart || sDate));
    }
    if (payload.assignedUserIds) patch.assignedUserIds = normalizeIdList(payload.assignedUserIds);

    const updated = await dutySlotsRepository.update(slotId, patch);

    // --- LOGGING ---
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: performerId,
      performerId: normalizeId(performerId),
      details: `Admin cập nhật thông tin kíp trực: ${slot.shiftLabel}`,
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
      type: 'registration',
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
      await dutyLogsRepository.create({
        type: 'swap_transfer',
        action: 'transfer',
        requestId: normalizeId(requestId),
        slotId: targetSlot.id,
        userId: req.requesterId,
        performerId: approverId,
        details: `Điều chuyển nhân sự: ${req.requesterId}. Lộ trình: ${req.fromSlotId ? `Kíp #${req.fromSlotId}` : 'N/A'} -> ${targetSlot.shiftLabel} (#${targetSlot.id})`,
        createdAt: new Date(),
      });

      // Notifications
      await notificationService.notifyUser(req.requesterId as number, {
        title: 'Điều chuyển kíp trực thành công',
        message: `Bạn đã được điều chuyển sang kíp trực: ${targetSlot.shiftLabel}.`,
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
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: performerId,
      performerId: normalizeId(performerId),
      details: `Điểm danh cho kíp: ${slot.shiftLabel}. Số người có mặt: ${userIds.length}`,
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
        await dutyLogsRepository.create({
          type: 'leave',
          action: 'approved',
          requestId: normalizeId(requestId),
          slotId: slot.id,
          userId: request.userId,
          performerId: normalizeId(approverId),
          details: `Duyệt đơn nghỉ kíp: ${slot.shiftLabel || slot.id}`,
          createdAt: new Date(),
        });

        // Notify member
        await notificationService.notifyUser(request.userId as number, {
          title: 'Đơn xin nghỉ đã được duyệt',
          message: `Yêu cầu xin nghỉ cho kíp ${slot.shiftLabel || ''} của bạn đã được chấp thuận.`,
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

    // 1. Fetch all shifts for this template
    const shifts = await this.getShiftTemplates(templateId);
    if (!shifts || shifts.length === 0) {
      throw ApiError.badRequest('Bản mẫu này không có ca trực nào để áp dụng.');
    }

    // 2. Iterate through each day in the range and "Stamp" the shifts
    let current = dayjs.utc(startDate).startOf('day');
    const end = dayjs.utc(endDate).startOf('day');
    const results = [];
    const allSlots: any[] = [];

    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      const dIdx = (current.day() + 6) % 7; // Mon=0...Sun=6

      for (const s of shifts as any[]) {
        const shiftDays = s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        if (shiftDays.includes(dIdx)) {
          // Use the established cloning logic for each shift with mode support
          // Note: Passing collectSlotsOnly=true to prevent multiple small inserts
          const { slots } = await this.addShiftToDay(dateStr, s.id, actorId, null, mode, true);
          if (slots) allSlots.push(...slots);
          results.push({ date: dateStr, shiftId: s.id });
        }
      }
      current = current.add(1, 'day');
    }

    if (allSlots.length > 0) {
      await dutySlotsRepository.insertMany(allSlots);
    }

    return { success: true, results };
  }

  async addShiftToDay(
    date: string,
    shiftId: number,
    actorId: Identifier,
    overrides: any = null,
    mode: string = 'kips',
    batchMode: boolean = false,
  ) {
    const dayRecord = await this.findOrCreateDay(date, actorId);
    const shiftTemplate = await dutyShiftsRepository.findById(shiftId);
    if (!shiftTemplate) throw ApiError.notFound('Shift not found');

    let finalShiftId = normalizeId(shiftId);
    let finalKipIds: number[] = [];

    // Deep Copy if it's from a template
    if (shiftTemplate.templateId) {
      const newShift = await dutyShiftsRepository.create({
        name: overrides?.name || shiftTemplate.name,
        startTime: overrides?.startTime || shiftTemplate.startTime,
        endTime: overrides?.endTime || shiftTemplate.endTime,
        order: overrides?.order !== undefined ? Number(overrides.order) : shiftTemplate.order,
        description: 'INSTANCE',
        templateId: null, // DISCONNECT
        isSpecialEvent:
          overrides?.isSpecialEvent !== undefined ? !!overrides.isSpecialEvent : !!shiftTemplate.isSpecialEvent,
        daysOfWeek: shiftTemplate.daysOfWeek,
      });
      finalShiftId = newShift.id as number;

      // ALSO CLONE KIPS for this shift
      const kips = await dutyKipsRepository.findMany({ shiftId: normalizeId(shiftId) });
      for (const k of kips) {
        const newKip = await dutyKipsRepository.create({
          shiftId: finalShiftId,
          name: k.name,
          coefficient: k.coefficient,
          capacity: k.capacity,
          startTime: k.startTime,
          endTime: k.endTime,
          order: k.order,
          endPeriod: k.endPeriod,
          daysOfWeek: k.daysOfWeek,
          description: 'INSTANCE',
        });
        finalKipIds.push(newKip.id as number);
      }
    }

    const existingIds = dayRecord.shiftTemplateIds || [];
    if (!existingIds.map(String).includes(String(finalShiftId))) {
      await dutyDaysRepository.update(dayRecord.id, {
        shiftTemplateIds: [...existingIds, finalShiftId],
      });
    }

    // IMPORTANT: Stamping must also create the Slot records in duty_slots or they won't appear as kips
    const dayOfWeek = (dayjs.utc(date).day() + 6) % 7;
    const weekStartIso = getWeekStartISO(date);

    // Fetch newly created kips or original kips if already an instance
    const effectiveShift = await dutyShiftsRepository.findById(finalShiftId);
    const effectiveKips = await dutyKipsRepository.findMany({ shiftId: finalShiftId });

    // Idempotency: Fetch existing slots for this shift instance on this day
    const existingSlots = await dutySlotsRepository.findMany({
      shiftDate: new Date(date).toISOString(),
      shiftId: finalShiftId,
    });

    const slots = [];

    // 1. Shift-level Slot
    if (mode === 'shifts') {
      const hasShiftSlot = existingSlots.some((s: any) => s.kipId === null);
      if (!hasShiftSlot && effectiveShift) {
        slots.push(
          this.buildSlotPayload(
            {
              weekStart: weekStartIso,
              shiftDate: date,
              dayId: dayRecord.id,
              shiftId: finalShiftId,
              kipId: null,
              shiftLabel: effectiveShift.name,
              startTime: effectiveShift.startTime,
              endTime: effectiveShift.endTime,
              capacity: 1,
              order: effectiveShift.order,
              isSpecialEvent: !!effectiveShift.isSpecialEvent,
              note: 'Individual Shift Slot',
            },
            actorId,
          ),
        );
      }
    }

    // 2. Kip-level Slots
    if (mode === 'kips' || mode === 'all') {
      for (const kip of effectiveKips) {
        const kipDays = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        if (!kipDays.includes(dayOfWeek)) continue;

        const hasKipSlot = existingSlots.some((s: any) => normalizeId(s.kipId) === normalizeId(kip.id as number));
        if (hasKipSlot) continue;

        slots.push(
          this.buildSlotPayload(
            {
              weekStart: weekStartIso,
              shiftDate: date,
              dayId: dayRecord.id,
              shiftId: finalShiftId,
              kipId: kip.id,
              shiftLabel: `${effectiveShift?.name || ''} - ${kip.name}`,
              startTime: kip.startTime || effectiveShift?.startTime,
              endTime: kip.endTime || effectiveShift?.endTime,
              capacity: kip.capacity,
              order: kip.order,
              endPeriod: kip.endPeriod,
              isSpecialEvent: effectiveShift ? !!effectiveShift.isSpecialEvent : false,
              note: kip.description || '',
            },
            actorId,
          ),
        );
      }
    }

    if (slots.length > 0 && !batchMode) {
      await dutySlotsRepository.insertMany(slots);
    }

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

  async removeShiftFromDay(date: string, shiftId: number) {
    const d = toUTCMidnight(date);
    const dayRecord = await dutyDaysRepository.findOne({ date: d.toISOString() });
    if (!dayRecord) throw ApiError.notFound('Day not found');

    const existingIds = dayRecord.shiftTemplateIds || [];
    // Remove ONLY ONE instance of this shiftId to support duplicate boundaries
    const index = existingIds.findIndex((id: any) => String(id) === String(shiftId));

    if (index !== -1) {
      const newIds = [...existingIds];
      newIds.splice(index, 1);
      await dutyDaysRepository.update(dayRecord.id, { shiftTemplateIds: newIds });

      // Cascade: Delete all slots (both shift-level and kips) belonging to this shift instance on this day
      // shiftId here is the instance ID
      await dutySlotsRepository.deleteMany({
        shiftDate: d.toISOString(),
        shiftId: Number(shiftId),
      });
    }
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
