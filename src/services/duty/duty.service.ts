import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';
import notificationService from '@services/notification/notification.service';

dayjs.extend(utc);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type Identifier = number | string;
type GenericRecord = Record<string, any>;

function normalizeId(id: unknown): Identifier {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? (id as Identifier) : parsed;
}

function normalizeIdList(values: unknown[] = []): Identifier[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => normalizeId(item)))];
}

function getActorId(user: GenericRecord | Identifier): Identifier {
  if (typeof user === 'object' && user !== null) return normalizeId(user.id);
  return normalizeId(user);
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

function paginate(items: GenericRecord[], page = 1, limit = 10) {
  const currentPage = Math.max(1, Number(page) || 1);
  const perPage = Math.max(1, Math.min(Number(limit) || 10, 100));
  const total = items.length;
  const totalPages = Math.ceil(total / perPage);
  const start = (currentPage - 1) * perPage;

  return {
    data: items.slice(start, start + perPage),
    pagination: {
      page: currentPage,
      limit: perPage,
      total,
      totalPages,
      hasPrev: currentPage > 1,
      hasNext: currentPage < totalPages,
    },
  };
}

class DutyService extends BaseService {
  constructor() {
    super('duty_slots');
  }

  buildSlotPayload(data: GenericRecord = {}, createdBy: Identifier | null = null) {
    const shiftDate = toUTCMidnight(data.shiftDate);
    const weekStartStr = getWeekStartISO(data.weekStart || shiftDate);

    return {
      weekStart: new Date(weekStartStr),
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
      order: Number(data.order) || 0,
      endPeriod: data.endPeriod ? Number(data.endPeriod) : null,
      note: data.note || '',
      capacity: data.capacity ? Number(data.capacity) : null,
      createdAt: new Date(data.createdAt || new Date()),
      updatedAt: new Date(),
    };
  }

  // ==================== TEMPLATE MANAGEMENT ====================

  async getTemplates() {
    const all = await db.findAll('duty_templates');
    return all.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }

  async createTemplate(data: GenericRecord) {
    const template = await db.create('duty_templates', {
      name: data.name,
      isDefault: !!data.isDefault,
      description: data.description || '',
    });
    if (data.isDefault) {
      const all = await db.findAll('duty_templates');
      for (const t of all) {
        if (normalizeId(t.id) !== normalizeId(template.id) && t.isDefault) {
          await db.update('duty_templates', t.id, { isDefault: false });
        }
      }
    }
    return template;
  }

  async updateTemplate(id: Identifier, data: GenericRecord) {
    const updated = await db.update('duty_templates', id, {
      name: data.name,
      isDefault: !!data.isDefault,
      description: data.description || '',
    });
    if (data.isDefault) {
      const all = await db.findAll('duty_templates');
      for (const t of all) {
        if (normalizeId(t.id) !== normalizeId(id) && t.isDefault) {
          await db.update('duty_templates', t.id, { isDefault: false });
        }
      }
    }
    return updated;
  }

  async deleteTemplate(id: Identifier) {
    const shifts = await db.findMany('duty_shifts', { templateId: normalizeId(id) });
    for (const s of shifts) {
      await this.deleteShiftTemplate(s.id);
    }
    return await db.delete('duty_templates', id);
  }

  async getShiftTemplates(templateId?: Identifier | null) {
    let filter: any = {};
    if (templateId !== undefined) {
      if (templateId) {
        filter.templateId = normalizeId(templateId);
      } else if (templateId === null) {
        // Individual shifts have templateId as null in our new system
        filter.templateId = null;
      }
    } else {
      // If nothing provided, we might want ALL shifts for the calendar to pick from
      // or just the default. For the calendar, "all" is safer.
      filter = {};
    }

    const shifts = await db.findMany('duty_shifts', filter);
    const kips = await db.findAll('duty_kips');
    return shifts
      .map((shift: any) => ({
        ...shift,
        kips: kips
          .filter((k: any) => normalizeId(k.shiftId) === normalizeId(shift.id))
          .sort((a: any, b: any) => (a.order || 0) - (b.order || 0)),
      }))
      .sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
  }

  async createShiftTemplate(data: GenericRecord) {
    return await db.create('duty_shifts', {
      templateId: data.templateId ? normalizeId(data.templateId) : null,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      order: Number(data.order) || 0,
      description: data.description || '',
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    });
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
    return await db.update('duty_shifts', id, {
      templateId: data.templateId ? normalizeId(data.templateId) : undefined,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      order: Number(data.order) || 0,
      description: data.description || '',
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : undefined,
    });
  }

  async deleteShiftTemplate(id: Identifier) {
    await db.deleteMany('duty_kips', { shiftId: normalizeId(id) });
    return await db.delete('duty_shifts', id);
  }

  async createKipTemplate(data: GenericRecord) {
    return await db.create('duty_kips', {
      shiftId: normalizeId(data.shiftId),
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      order: Number(data.order) || 0,
      endPeriod: data.endPeriod ? Number(data.endPeriod) : null,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
      description: data.description || '',
    });
  }

  async updateKipTemplate(id: Identifier, data: GenericRecord) {
    return await db.update('duty_kips', id, {
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      order: Number(data.order) || 0,
      endPeriod: data.endPeriod ? Number(data.endPeriod) : null,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
      description: data.description || '',
    });
  }

  async deleteKipTemplate(id: Identifier) {
    return await db.delete('duty_kips', id);
  }

  async findOrCreateDay(date: string, actorId: Identifier) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const isoDate = d.toISOString();

    let dayRecord = await db.findOne('duty_days', { date: isoDate });
    if (!dayRecord) {
      dayRecord = await db.create('duty_days', {
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
    const existing = await db.findOne('duty_slots', { weekStart: new Date(startIso) });
    if (existing) throw ApiError.badRequest('Schedule already exists for this week');

    const shifts = await this.getShiftTemplates();
    const slots = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startIso);
      d.setUTCDate(d.getUTCDate() + i);
      const isoDate = d.toISOString();
      const dayRecord = await this.findOrCreateDay(isoDate, actorId);

      for (const shift of shifts as any[]) {
        for (const kip of shift.kips) {
          const days = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
          if (!days.includes(i)) continue;

          slots.push(
            this.buildSlotPayload(
              {
                weekStart: startIso,
                shiftDate: isoDate,
                dayId: dayRecord.id,
                shiftId: shift.id,
                kipId: kip.id,
                shiftLabel: `${shift.name} - ${kip.name}`,
                startTime: kip.startTime || shift.startTime,
                endTime: kip.endTime || shift.endTime,
                capacity: kip.capacity,
                order: kip.order,
                endPeriod: kip.endPeriod,
                note: kip.description || kip.duration || '',
              },
              actorId,
            ),
          );
        }
      }
    }
    return await db.insertMany('duty_slots', slots);
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
              order: kip.order,
              endPeriod: kip.endPeriod,
              note: kip.description || kip.duration || '',
            },
            actorId,
          ),
        );
      }
    }
    if (slots.length === 0) return [];
    return await db.insertMany('duty_slots', slots);
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
    const assignments = await db.findMany('duty_template_assignments', {
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
          const defaultTemplate = await db.findOne('duty_templates', { isDefault: true });
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

        const newShift = await db.create('duty_shifts', {
          name: s.name,
          startTime: s.startTime,
          endTime: s.endTime,
          order: s.order,
          description: 'INSTANCE',
          templateId: null, // DISCONNECT from template group
          daysOfWeek: [dayOfWeek],
        });

        persistentShiftIds.push(newShift.id);
        shiftMap.set(s.id, newShift.id);
      }

      await db.update('duty_days', dayRecord.id, {
        shiftTemplateIds: persistentShiftIds,
      });

      for (const shift of shifts as any[]) {
        if (!shiftMap.has(shift.id)) continue;
        const persistentShiftId = shiftMap.get(shift.id)!;

        if (mode === 'shifts' || mode === 'all') {
          allSlots.push(
            this.buildSlotPayload(
              {
                weekStart: weekStartIso,
                shiftDate: isoDate,
                dayId: dayRecord.id,
                shiftId: shift.id,
                kipId: null,
                shiftLabel: shift.name,
                startTime: shift.startTime,
                endTime: shift.endTime,
                order: shift.order,
                note: shift.description || '',
              },
              actorId,
            ),
          );
        }

        if (mode === 'kips' || mode === 'all') {
          for (const kip of shift.kips) {
            const kipDays = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
            if (!kipDays.includes(dayOfWeek)) continue;

            allSlots.push(
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
                  order: kip.order,
                  endPeriod: kip.endPeriod,
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

    await db.deleteMany('duty_slots', {
      shiftDate_gte: s.toISOString(),
      shiftDate_lte: e.toISOString(),
    });

    return await db.insertMany('duty_slots', allSlots);
  }

  async deleteRangeSlots(startDate: string, endDate: string) {
    const s = toUTCMidnight(startDate);
    const e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);

    return await db.deleteMany('duty_slots', {
      shiftDate_gte: s.toISOString(),
      shiftDate_lte: e.toISOString(),
    });
  }

  async copyWeekSchedule(sourceWeekStart: string, targetWeekStart: string, actorId: Identifier) {
    const srcIso = getWeekStartISO(sourceWeekStart);
    const targetIso = getWeekStartISO(targetWeekStart);

    const existingTarget = await db.findOne('duty_slots', { weekStart: new Date(targetIso) });
    if (existingTarget) throw ApiError.badRequest('Target week already has slots');

    const sourceSlots = await db.findMany('duty_slots', { weekStart: new Date(srcIso) });
    if (!sourceSlots || sourceSlots.length === 0) throw ApiError.badRequest('Source week is empty');

    const newSlots = sourceSlots.map((slot: any) => {
      const d = new Date(slot.shiftDate);
      const dayOffset = (d.getTime() - new Date(srcIso).getTime()) / (1000 * 60 * 60 * 24);
      const t = new Date(targetIso);
      t.setUTCDate(t.getUTCDate() + Math.round(dayOffset));

      return this.buildSlotPayload(
        {
          weekStart: targetIso,
          shiftDate: t.toISOString(),
          kipId: slot.kipId,
          shiftLabel: slot.shiftLabel,
          startTime: slot.startTime,
          endTime: slot.endTime,
          order: slot.order,
          endPeriod: slot.endPeriod,
          note: slot.note,
        },
        actorId,
      );
    });

    return await db.insertMany('duty_slots', newSlots);
  }

  async deleteWeeklySlots(weekStart: string) {
    const startIso = getWeekStartISO(weekStart);
    return await db.deleteMany('duty_slots', { weekStart: new Date(startIso) });
  }

  async getWeeklySchedule(options: any = {}) {
    const weekStart = getWeekStartISO(options.weekStart);
    const weekEnd = getWeekEndISO(weekStart);

    const result = await db.findAllAdvanced('duty_slots', {
      ...options,
      limit: 1000,
      filter: {
        ...(options.filter || {}),
        shiftDate_gte: weekStart,
        shiftDate_lte: weekEnd,
      },
      expand: 'kip',
      sort: options.sort || 'shiftDate,startTime',
      order: options.order || 'asc',
    });

    const users = await db.findAll('users');
    const userMap = new Map(
      users.map((u) => [normalizeId(u.id), { id: u.id, name: u.name, role: u.role, avatar: u.avatar }]),
    );

    const data = result.data.map((slot) => {
      const assignedIds = normalizeIdList(slot.assignedUserIds || []);
      return {
        ...slot,
        assignedUserIds: assignedIds,
        assignedUsers: assignedIds.map((id) => userMap.get(id)).filter(Boolean),
      };
    });

    // Fetch assignments that overlap with this week
    // Fetch assignments and days with a generous +/- 1 day buffer to handle timezone-shifted dates
    const queryStart = dayjs.utc(weekStart).subtract(1, 'day').toDate();
    const queryEnd = dayjs.utc(weekEnd).add(1, 'day').toDate();

    const assignments = await db.findMany('duty_template_assignments', {
      startDate_lte: queryEnd,
      endDate_gte: queryStart,
    });

    const days = await db.findMany('duty_days', {
      date_gte: queryStart,
      date_lte: queryEnd,
    });

    return {
      data: { slots: data, days, assignments },
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
        const shiftTemplate = await db.findById('duty_shifts', finalShiftId);
        // Only deep copy if it's currently linked to a template
        if (shiftTemplate && shiftTemplate.templateId) {
          const newShift = await db.create('duty_shifts', {
            name: shiftTemplate.name,
            startTime: shiftTemplate.startTime,
            endTime: shiftTemplate.endTime,
            order: shiftTemplate.order,
            templateId: null, // DISCONNECT
            description: 'INSTANCE',
            daysOfWeek: shiftTemplate.daysOfWeek,
          });
          finalShiftId = newShift.id;
        }

        if (!existingIds.map(String).includes(String(finalShiftId))) {
          await db.update('duty_days', dayRecord.id, {
            shiftTemplateIds: [...existingIds, finalShiftId],
          });
        }
      }
    }

    const data = this.buildSlotPayload({ ...payload, dayId: dayRecord.id, shiftId: finalShiftId }, actorId);
    return await db.create('duty_slots', data);
  }

  async deleteSlot(id: Identifier) {
    const slot = await db.findById('duty_slots', id);
    if (!slot) throw ApiError.notFound('Slot not found');
    await db.delete('duty_slots', id);
    return { success: true };
  }

  async deleteShiftSlots(date: string, shiftId: number) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return await db.deleteMany('duty_slots', { shiftDate: d, shiftId: Number(shiftId) });
  }

  async updateSlot(slotId: Identifier, payload: GenericRecord = {}) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const patch: GenericRecord = { ...payload, updatedAt: new Date().toISOString() };
    if (payload.shiftDate || payload.weekStart) {
      const sDate = payload.shiftDate ? new Date(payload.shiftDate) : new Date(slot.shiftDate);
      sDate.setUTCHours(0, 0, 0, 0);
      patch.shiftDate = sDate;
      patch.weekStart = new Date(getWeekStartISO(payload.weekStart || sDate));
    }
    if (payload.assignedUserIds) patch.assignedUserIds = normalizeIdList(payload.assignedUserIds);
    return await db.update('duty_slots', slotId, patch);
  }

  async registerToSlot(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Slot not found');
    if (slot.status === 'locked') throw ApiError.badRequest('Locked');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (assigned.includes(userId)) throw ApiError.badRequest('Already registered');

    // Get capacity: use slot override if present, otherwise associated Kip
    let maxCapacity = Number(slot.capacity);
    if (!maxCapacity || isNaN(maxCapacity)) {
      const kip = await db.findById('duty_kips', slot.kipId);
      maxCapacity = Number(kip?.capacity) || 1;
    }

    if (assigned.length >= maxCapacity) throw ApiError.badRequest('Full');

    const updated = await db.update('duty_slots', slot.id, {
      assignedUserIds: [...assigned, userId],
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
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Slot not found');
    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (!assigned.includes(userId)) throw ApiError.badRequest('Not registered');

    const updated = await db.update('duty_slots', slot.id, {
      assignedUserIds: assigned.filter((id) => id !== userId),
      updatedAt: new Date().toISOString(),
    });
    return updated;
  }

  async requestSwap(payload: GenericRecord, requesterUser: GenericRecord) {
    const slotId = normalizeId(payload.slotId || payload.dutySlotId);
    const targetUserId = normalizeId(payload.targetUserId);
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const created = await db.create('duty_swap_requests', {
      dutySlotId: slotId,
      requesterId: normalizeId(requesterUser.id),
      targetUserId: targetUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(targetUserId, {
      title: 'Yêu cầu đổi ca trực',
      message: `${requesterUser.name} muốn đổi ca với bạn: ${slot.shiftLabel}`,
      category: 'swap',
      type: 'swap',
      refId: created.id,
    });

    return created;
  }

  async getSwapRequests(user: GenericRecord, options: GenericRecord = {}) {
    const userId = normalizeId(user.id);
    const isApprover = user.role === 'admin' || user.role === 'staff';
    const all = await db.findAll('duty_swap_requests');
    let filtered = isApprover ? all : all.filter((r) => r.requesterId === userId || r.targetUserId === userId);
    return paginate(filtered, options.page, options.limit);
  }

  async decideSwap(requestId: Identifier, payload: GenericRecord = {}, approverUser: GenericRecord) {
    const req = await db.findById('duty_swap_requests', requestId);
    if (!req) throw ApiError.notFound('Request not found');
    const status = payload.status || payload.decision;
    if (status === 'approved') {
      const slot = await db.findById('duty_slots', req.dutySlotId);
      const assigned = normalizeIdList(slot.assignedUserIds);
      const next = [...assigned.filter((id) => id !== req.requesterId), req.targetUserId];
      await db.update('duty_slots', slot.id, { assignedUserIds: next });
    }
    return await db.update('duty_swap_requests', requestId, { status, approvedBy: normalizeId(approverUser.id) });
  }

  async markAttendance(slotId: Identifier, userIds: Identifier[]) {
    return await db.update('duty_slots', slotId, { attendedUserIds: userIds });
  }

  async requestLeave(slotId: Identifier, userId: Identifier, reason: string) {
    return await db.create('duty_leave_requests', {
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
      reason,
      status: 'pending',
    });
  }

  async getLeaveRequests(options: GenericRecord = {}) {
    const result = await db.findAllAdvanced('duty_leave_requests', {
      ...options,
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
    });

    const users = await db.findAll('users');
    const userMap = new Map(users.map((u) => [normalizeId(u.id), { id: u.id, name: u.name, avatar: u.avatar }]));

    const slots = await db.findAll('duty_slots');
    const slotMap = new Map(slots.map((s) => [normalizeId(s.id), s]));

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
    const request = await db.findById('duty_leave_requests', requestId);
    if (!request) throw ApiError.notFound('Leave request not found');

    const now = new Date().toISOString();
    const updated = await db.update('duty_leave_requests', requestId, {
      status,
      approvedBy: normalizeId(approverId),
      rejectionReason,
      updatedAt: now,
    });

    if (status === 'approved') {
      const slot = await db.findById('duty_slots', request.slotId);
      if (slot) {
        const assigned = normalizeIdList(slot.assignedUserIds || []);
        const nextAssigned = assigned.filter((id) => id !== normalizeId(request.userId));
        await db.update('duty_slots', slot.id, { assignedUserIds: nextAssigned, updatedAt: now });
      }
    }
    return updated;
  }

  async getStats() {
    const slots = (await db.findAll('duty_slots')) || [];
    return {
      global: {
        total: slots.length,
        open: slots.filter((s: any) => s.status === 'open').length,
        locked: slots.filter((s: any) => s.status === 'locked').length,
        totalAssigned: slots.reduce((acc: number, s: any) => acc + (s.assignedUserIds?.length || 0), 0),
      },
    };
  }

  // ==================== TEMPLATE ASSIGNMENT ====================

  async getTemplateAssignments() {
    return await db.findAll('duty_template_assignments');
  }

  async createTemplateAssignment(data: any, actorId: any) {
    const startDate = toUTCMidnight(data.startDate);
    const endDate = dayjs.utc(data.endDate).endOf('day').toDate();
    const templateId = parseInt(data.templateId, 10);

    // 1. Fetch all shifts for this template
    const shifts = await this.getShiftTemplates(templateId);
    if (!shifts || shifts.length === 0) {
      throw ApiError.badRequest('Bản mẫu này không có ca trực nào để áp dụng.');
    }

    // 2. Iterate through each day in the range and "Stamp" the shifts
    let current = dayjs.utc(startDate);
    const end = dayjs.utc(endDate);
    const results = [];

    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      const dIdx = (current.day() + 6) % 7; // Mon=0...Sun=6

      // Find shifts that apply to this day of week
      const applicableShiftIds = shifts
        .filter((s) => (s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dIdx))
        .map((s) => normalizeId(s.id));

      if (applicableShiftIds.length > 0) {
        const dayRecord = await this.findOrCreateDay(dateStr, actorId);
        const existingIds = dayRecord.shiftTemplateIds || [];

        // Merge without duplicates
        const mergedIds = [...new Set([...existingIds, ...applicableShiftIds])];

        if (mergedIds.length > existingIds.length) {
          await db.update('duty_days', dayRecord.id, { shiftTemplateIds: mergedIds });
        }
        results.push({ date: dateStr, shifts: applicableShiftIds });
      }
      current = current.add(1, 'day');
    }

    // 3. Log the assignment for history (optional but useful)
    return await db.create('duty_template_assignments', {
      templateId,
      startDate,
      endDate,
      note: data.note || `Applied stamping for ${results.length} days`,
      createdBy: parseInt(actorId, 10),
      createdAt: new Date().toISOString(),
    });
  }

  async addShiftToDay(date: string, shiftId: number, actorId: Identifier) {
    const dayRecord = await this.findOrCreateDay(date, actorId);
    const shiftTemplate = await db.findById('duty_shifts', shiftId);
    if (!shiftTemplate) throw ApiError.notFound('Shift not found');

    let finalShiftId = normalizeId(shiftId);
    // Deep Copy if it's from a template
    if (shiftTemplate.templateId) {
      const newShift = await db.create('duty_shifts', {
        name: shiftTemplate.name,
        startTime: shiftTemplate.startTime,
        endTime: shiftTemplate.endTime,
        order: shiftTemplate.order,
        description: 'INSTANCE',
        templateId: null, // DISCONNECT
        daysOfWeek: shiftTemplate.daysOfWeek,
      });
      finalShiftId = newShift.id;
    }

    const existingIds = dayRecord.shiftTemplateIds || [];
    if (!existingIds.map(String).includes(String(finalShiftId))) {
      await db.update('duty_days', dayRecord.id, {
        shiftTemplateIds: [...existingIds, finalShiftId],
      });
    }
    return { success: true };
  }

  async removeShiftFromDay(date: string, shiftId: number) {
    const d = toUTCMidnight(date);
    const dayRecord = await db.findOne('duty_days', { date: d });
    if (!dayRecord) throw ApiError.notFound('Day not found');

    const existingIds = dayRecord.shiftTemplateIds || [];
    // Remove ONLY ONE instance of this shiftId to support duplicate boundaries
    const index = existingIds.findIndex((id) => String(id) === String(shiftId));

    if (index !== -1) {
      const newIds = [...existingIds];
      newIds.splice(index, 1);
      await db.update('duty_days', dayRecord.id, { shiftTemplateIds: newIds });
    }
    return { success: true };
  }

  async updateTemplateAssignment(id: any, data: any) {
    const update: any = { updatedAt: new Date().toISOString() };
    if (data.startDate) update.startDate = new Date(data.startDate).toISOString();
    if (data.endDate) update.endDate = new Date(data.endDate).toISOString();
    if (data.templateId) update.templateId = parseInt(data.templateId, 10);
    if (data.note !== undefined) update.note = data.note;

    return await db.update('duty_template_assignments', id, update);
  }

  async deleteTemplateAssignment(id: any) {
    return await db.delete('duty_template_assignments', id);
  }
}

export default new DutyService();
