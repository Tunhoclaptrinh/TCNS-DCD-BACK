import BaseService from 'src/common/base-service';
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

class DutyService extends BaseService {
  constructor() {
    super('duty_slots');
  }

  buildSlotPayload(data: GenericRecord = {}, createdBy: Identifier | null = null) {
    const now = new Date().toISOString();
    const shiftDate = new Date(data.shiftDate || now).toISOString();
    const weekStart = getWeekStartISO(data.weekStart || shiftDate);

    return {
      weekStart,
      shiftDate,
      shiftLabel: data.shiftLabel,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      capacity: Math.max(1, Number(data.capacity) || 1),
      assignedUserIds: normalizeIdList(data.assignedUserIds || []),
      status: data.status || 'open',
      createdBy: normalizeId(data.createdBy || createdBy),
      note: data.note || '',
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
  }

  async getWeeklySchedule(options: GenericRecord = {}) {
    const weekStart = getWeekStartISO(options.weekStart || new Date().toISOString());
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
      const assignedUserIds = normalizeIdList(slot.assignedUserIds || []);
      return {
        ...slot,
        assignedUserIds,
        assignedUsers: assignedUserIds.map((id) => userMap.get(id)).filter(Boolean),
      };
    });

    return {
      data,
      weekStart,
      weekEnd,
      pagination: result.pagination,
    };
  }

  async createSlot(payload: GenericRecord, actorId: Identifier) {
    if (!payload?.shiftLabel || !payload?.shiftDate) {
      throw ApiError.badRequest('shiftLabel and shiftDate are required');
    }

    const slotPayload = this.buildSlotPayload(payload, actorId);
    const created = await db.create('duty_slots', slotPayload);
    return created;
  }

  async updateSlot(slotId: Identifier, payload: GenericRecord = {}) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');

    const patch: GenericRecord = { ...payload, updatedAt: new Date().toISOString() };

    if (payload.shiftDate || payload.weekStart) {
      const shiftDate = payload.shiftDate ? new Date(payload.shiftDate).toISOString() : slot.shiftDate;
      patch.shiftDate = shiftDate;
      patch.weekStart = getWeekStartISO(payload.weekStart || shiftDate);
    }

    if (payload.assignedUserIds) {
      patch.assignedUserIds = normalizeIdList(payload.assignedUserIds);
    }

    if (payload.capacity !== undefined) {
      patch.capacity = Math.max(1, Number(payload.capacity) || 1);
    }

    return await db.update('duty_slots', slotId, patch);
  }

  async registerToSlot(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');
    if (slot.status === 'locked') throw ApiError.badRequest('Duty slot is locked');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);

    if (assigned.includes(userId)) {
      throw ApiError.badRequest('You have already registered this duty slot');
    }

    const capacity = Math.max(1, Number(slot.capacity) || 1);
    if (assigned.length >= capacity) {
      throw ApiError.badRequest('Duty slot is full');
    }

    const sameDateSlots = await db.findMany('duty_slots', { shiftDate: slot.shiftDate });
    const hasConflict = sameDateSlots.some((item) => {
      if (normalizeId(item.id) === normalizeId(slot.id)) return false;
      const itemAssigned = normalizeIdList(item.assignedUserIds || []);
      if (!itemAssigned.includes(userId)) return false;
      return (item.startTime || '') === (slot.startTime || '') && (item.endTime || '') === (slot.endTime || '');
    });

    if (hasConflict) {
      throw ApiError.badRequest('You already have another duty slot at this time');
    }

    const updated = await db.update('duty_slots', slot.id, {
      assignedUserIds: [...assigned, userId],
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Đăng ký ca trực thành công',
      message: `Bạn đã đăng ký ca '${slot.shiftLabel}' ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}.`,
      category: 'shift',
      type: 'shift',
      refId: slot.id,
      metadata: { action: 'register' },
    });

    return updated;
  }

  async cancelRegistration(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);

    if (!assigned.includes(userId)) {
      throw ApiError.badRequest('You have not registered this duty slot');
    }

    const updated = await db.update('duty_slots', slot.id, {
      assignedUserIds: assigned.filter((id) => id !== userId),
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Hủy ca trực thành công',
      message: `Bạn đã hủy ca '${slot.shiftLabel}' ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}.`,
      category: 'shift',
      type: 'shift',
      refId: slot.id,
      metadata: { action: 'cancel' },
    });

    return updated;
  }

  async requestSwap(payload: GenericRecord, requesterUser: GenericRecord) {
    const slotId = payload?.dutySlotId || payload?.slotId;
    const targetUserIdRaw = payload?.targetUserId;
    const reason = String(payload?.reason || '').trim();

    if (!slotId || !targetUserIdRaw || !reason) {
      throw ApiError.badRequest('dutySlotId, targetUserId and reason are required');
    }

    const requesterId = normalizeId(requesterUser.id);
    const targetUserId = normalizeId(targetUserIdRaw);

    if (requesterId === targetUserId) {
      throw ApiError.badRequest('Cannot swap duty slot with yourself');
    }

    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');

    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (!assigned.includes(requesterId)) {
      throw ApiError.badRequest('You are not assigned to this duty slot');
    }

    if (assigned.includes(targetUserId)) {
      throw ApiError.badRequest('Target user is already assigned to this duty slot');
    }

    const targetUser = await db.findById('users', targetUserId);
    if (!targetUser || !targetUser.isActive) {
      throw ApiError.badRequest('Target user is invalid or inactive');
    }

    const existingPending = await db.findOne('duty_swap_requests', {
      dutySlotId: normalizeId(slot.id),
      requesterId,
      targetUserId,
      status: 'pending',
    });

    if (existingPending) {
      throw ApiError.badRequest('A pending swap request already exists for this slot and target user');
    }

    const now = new Date().toISOString();
    const created = await db.create('duty_swap_requests', {
      dutySlotId: normalizeId(slot.id),
      requesterId,
      targetUserId,
      reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    const allUsers = await db.findAll('users');
    const approverIds = allUsers
      .filter((u) => u.isActive && (u.role === 'admin' || u.role === 'staff'))
      .map((u) => normalizeId(u.id));

    await notificationService.notifyUser(requesterId, {
      title: 'Yêu cầu đổi ca đã gửi',
      message: `Yêu cầu đổi ca '${slot.shiftLabel}' của bạn đang chờ duyệt.`,
      category: 'approval',
      type: 'approval',
      refId: created.id,
      metadata: { action: 'swap_request_created' },
    });

    await notificationService.notifyUser(targetUserId, {
      title: 'Bạn có yêu cầu nhận ca trực',
      message: `Bạn vừa nhận được yêu cầu đổi ca '${slot.shiftLabel}'.`,
      category: 'approval',
      type: 'approval',
      refId: created.id,
      metadata: { action: 'swap_requested_to_you' },
    });

    await notificationService.notifyUsers(approverIds, {
      title: 'Yêu cầu duyệt đổi ca',
      message: `Có yêu cầu đổi ca mới cần duyệt cho ca '${slot.shiftLabel}'.`,
      category: 'approval',
      type: 'approval',
      refId: created.id,
      metadata: { action: 'swap_pending_review' },
    });

    return created;
  }

  async getSwapRequests(user: GenericRecord, options: GenericRecord = {}) {
    const userId = normalizeId(user.id);
    const isApprover = user.role === 'admin' || user.role === 'staff';

    if (isApprover) {
      return await db.findAllAdvanced('duty_swap_requests', {
        ...options,
        sort: options.sort || 'createdAt',
        order: options.order || 'desc',
      });
    }

    const requesterItems = await db.findMany('duty_swap_requests', { requesterId: userId });
    const targetItems = await db.findMany('duty_swap_requests', { targetUserId: userId });

    const map = new Map<Identifier, GenericRecord>();
    for (const item of [...requesterItems, ...targetItems]) {
      map.set(item.id, item);
    }

    let merged = [...map.values()];

    const statusFilter = options?.filter?.status;
    if (statusFilter) {
      merged = merged.filter((item) => item.status === statusFilter);
    }

    merged.sort((a, b) => new Date(String(b.createdAt || 0)).getTime() - new Date(String(a.createdAt || 0)).getTime());
    return paginate(merged, options.page, options.limit);
  }

  async decideSwap(requestId: Identifier, payload: GenericRecord = {}, approverUser: GenericRecord) {
    const swapRequest = await db.findById('duty_swap_requests', requestId);
    if (!swapRequest) throw ApiError.notFound('Swap request not found');

    if (swapRequest.status !== 'pending') {
      throw ApiError.badRequest(`Swap request is already ${swapRequest.status}`);
    }

    const decision = String(payload.decision || payload.status || '').toLowerCase();
    const note = String(payload.note || payload.reason || payload.decisionNote || '').trim();

    if (!['approved', 'rejected'].includes(decision)) {
      throw ApiError.badRequest("decision must be 'approved' or 'rejected'");
    }

    const now = new Date().toISOString();

    if (decision === 'approved') {
      const slot = await db.findById('duty_slots', swapRequest.dutySlotId);
      if (!slot) throw ApiError.notFound('Duty slot not found');

      const requesterId = normalizeId(swapRequest.requesterId);
      const targetUserId = normalizeId(swapRequest.targetUserId);
      const assigned = normalizeIdList(slot.assignedUserIds || []);

      if (!assigned.includes(requesterId)) {
        throw ApiError.badRequest('Requester is no longer assigned to this duty slot');
      }

      if (assigned.includes(targetUserId)) {
        throw ApiError.badRequest('Target user is already assigned to this duty slot');
      }

      const nextAssigned = [...assigned.filter((id) => id !== requesterId), targetUserId];
      await db.update('duty_slots', slot.id, {
        assignedUserIds: nextAssigned,
        updatedAt: now,
      });
    }

    const updatedRequest = await db.update('duty_swap_requests', requestId, {
      status: decision,
      decisionNote: note,
      approvedBy: normalizeId(approverUser.id),
      approvedAt: now,
      updatedAt: now,
    });

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
    } else {
      await notificationService.notifyUser(swapRequest.requesterId, {
        title: 'Yêu cầu đổi ca bị từ chối',
        message: note || 'Yêu cầu đổi ca của bạn đã bị từ chối.',
        category: 'approval',
        type: 'approval',
        refId: swapRequest.id,
        metadata: { decision: 'rejected' },
      });
    }

    return updatedRequest;
  }

  async getStats() {
    const slots = await db.findAll('duty_slots');
    const stats = {
      total: slots.length,
      open: slots.filter((s) => s.status === 'open').length,
      locked: slots.filter((s) => s.status === 'locked').length,
      totalAssigned: slots.reduce((acc, s) => acc + (s.assignedUserIds?.length || 0), 0),
    };

    return {
      success: true,
      data: {
        global: stats,
        byDepartment: {}, // Add department breakdown if needed later
      },
    };
  }
}

export default new DutyService();
