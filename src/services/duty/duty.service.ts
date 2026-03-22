import dayjs from 'dayjs';
import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';
import notificationService from '@services/notification/notification.service';

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
  if (typeof user === 'object' && user !== null) {
    return normalizeId(user.id);
  }
  return normalizeId(user);
}

function getWeekStartISO(input?: string | number | Date) {
  const date = new Date(input || Date.now());
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest('Invalid date input');
  }
  const day = date.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diff);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function getWeekEndISO(weekStartIso: string) {
  const end = new Date(weekStartIso);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
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

function toUTCMidnight(date: any): Date {
  if (!date) return new Date();
  const d = dayjs(date);
  // Always extract YYYY-MM-DD part first to avoid timezone shifts
  return new Date(d.format('YYYY-MM-DD') + 'T00:00:00Z');
}

class DutyService extends BaseService {
  constructor() {
    super('duty_slots');
  }

  buildSlotPayload(data: GenericRecord = {}, createdBy: Identifier | null = null) {
    const now = new Date().toISOString();
    const d = new Date(data.shiftDate || now);
    d.setUTCHours(0, 0, 0, 0);
    const shiftDate = d.toISOString();
    const weekStart = getWeekStartISO(data.weekStart || shiftDate);

    return {
      weekStart: new Date(weekStart),
      shiftDate: new Date(shiftDate),
      dayId: data.dayId ? normalizeId(data.dayId) : null,
      kipId: data.kipId ? normalizeId(data.kipId) : null,
      shiftId: data.shiftId ? normalizeId(data.shiftId) : null,
      shiftLabel: data.shiftLabel,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      capacity: Math.max(1, Number(data.capacity) || 1),
      assignedUserIds: normalizeIdList(data.assignedUserIds || []),
      status: data.status || 'open',
      createdBy: normalizeId(data.createdBy || createdBy),
      order: Number(data.order) || 0,
      endPeriod: data.endPeriod ? Number(data.endPeriod) : null,
      note: data.note || '',
      createdAt: new Date(data.createdAt || now),
      updatedAt: new Date(now),
    };
  }

  async getShiftTemplates() {
    const shifts = await db.findAll('duty_shifts');
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
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      order: Number(data.order) || 0,
      description: data.description || '',
    });
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
    return await db.update('duty_shifts', id, {
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      order: Number(data.order) || 0,
      description: data.description || '',
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

  async generateRangeSlots(startDate: string, endDate: string, actorId: Identifier) {
    const s = toUTCMidnight(startDate);
    const e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);

    if (e < s) throw ApiError.badRequest('End date must be after start date');

    const shifts = await this.getShiftTemplates();
    const allSlots = [];

    let curr = new Date(s);
    while (curr <= e) {
      const isoDate = curr.toISOString();
      const dayOfWeek = (curr.getUTCDay() + 6) % 7;
      const weekStartIso = getWeekStartISO(isoDate);
      const dayRecord = await this.findOrCreateDay(isoDate, actorId);

      for (const shift of shifts as any[]) {
        for (const kip of shift.kips) {
          const days = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
          if (!days.includes(dayOfWeek)) continue;

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
          capacity: slot.capacity,
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
      filter: {
        ...(options.filter || {}),
        shiftDate_gte: weekStart,
        shiftDate_lte: weekEnd,
      },
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

    const days = await db.findMany('duty_days', { date_gte: weekStart, date_lte: weekEnd });

    return {
      data: { slots: data, days },
      weekStart,
      weekEnd,
      pagination: result.pagination,
    };
  }

  async createSlot(payload: GenericRecord, actorId: Identifier) {
    if (!payload?.shiftLabel || !payload?.shiftDate) throw ApiError.badRequest('shiftLabel and shiftDate required');
    const dayRecord = await this.findOrCreateDay(payload.shiftDate, actorId);
    return await db.create('duty_slots', this.buildSlotPayload({ ...payload, dayId: dayRecord.id }, actorId));
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
    if (assigned.length >= (Number(slot.capacity) || 1)) throw ApiError.badRequest('Full');

    const updated = await db.update('duty_slots', slot.id, {
      assignedUserIds: [...assigned, userId],
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Đăng ký thành công',
      message: `Ca '${slot.shiftLabel}' ${new Date(slot.shiftDate).toLocaleDateString()}`,
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
      targetUserId,
      reason: payload.reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
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
    const slots = await db.findAll('duty_slots');
    return {
      success: true,
      data: {
        global: {
          total: slots.length,
          open: slots.filter((s) => s.status === 'open').length,
          locked: slots.filter((s) => s.status === 'locked').length,
          totalAssigned: slots.reduce((acc, s) => acc + (s.assignedUserIds?.length || 0), 0),
        },
      },
    };
  }
}

export default new DutyService();
