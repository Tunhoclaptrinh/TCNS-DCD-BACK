import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';
import notificationService from '@services/common/notification.service';

function normalizeId(id) {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

function normalizeIdList(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((item) => normalizeId(item)))];
}

function getWeekStartISO(input) {
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

function getWeekEndISO(weekStartIso) {
  const end = new Date(weekStartIso);
  end.setUTCDate(end.getUTCDate() + 6);
  end.setUTCHours(23, 59, 59, 999);
  return end.toISOString();
}

function paginate(items, page = 1, limit = 10) {
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

  buildSlotPayload(data = {}, createdBy = null) {
    const now = new Date().toISOString();
    const shiftDate = new Date(data.shift_date || now).toISOString();
    const weekStart = getWeekStartISO(data.week_start || shiftDate);

    return {
      week_start: weekStart,
      shift_date: shiftDate,
      shift_label: data.shift_label,
      start_time: data.start_time || null,
      end_time: data.end_time || null,
      capacity: Math.max(1, Number(data.capacity) || 1),
      assigned_user_ids: normalizeIdList(data.assigned_user_ids || []),
      status: data.status || 'open',
      created_by: normalizeId(data.created_by || createdBy),
      note: data.note || '',
      createdAt: data.createdAt || now,
      updatedAt: now,
    };
  }

  async getWeeklySchedule(options = {}) {
    const weekStart = getWeekStartISO(options.week_start || options.weekStart || new Date().toISOString());
    const weekEnd = getWeekEndISO(weekStart);

    const result = await db.findAllAdvanced('duty_slots', {
      ...options,
      filter: {
        ...(options.filter || {}),
        shift_date_gte: weekStart,
        shift_date_lte: weekEnd,
      },
      sort: options.sort || 'shift_date,start_time',
      order: options.order || 'asc',
    });

    const users = await db.findAll('users');
    const userMap = new Map(
      users.map((u) => [normalizeId(u.id), { id: u.id, name: u.name, role: u.role, avatar: u.avatar }]),
    );

    const data = result.data.map((slot) => {
      const assignedUserIds = normalizeIdList(slot.assigned_user_ids || []);
      return {
        ...slot,
        assigned_user_ids: assignedUserIds,
        assigned_users: assignedUserIds.map((id) => userMap.get(id)).filter(Boolean),
      };
    });

    return {
      data,
      week_start: weekStart,
      week_end: weekEnd,
      pagination: result.pagination,
    };
  }

  async createSlot(payload, actorId) {
    if (!payload?.shift_label || !payload?.shift_date) {
      throw ApiError.badRequest('shift_label and shift_date are required');
    }

    const slotPayload = this.buildSlotPayload(payload, actorId);
    const created = await db.create('duty_slots', slotPayload);
    return created;
  }

  async updateSlot(slotId, payload = {}) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');

    const patch = { ...payload, updatedAt: new Date().toISOString() };

    if (payload.shift_date || payload.week_start) {
      const shiftDate = payload.shift_date ? new Date(payload.shift_date).toISOString() : slot.shift_date;
      patch.shift_date = shiftDate;
      patch.week_start = getWeekStartISO(payload.week_start || shiftDate);
    }

    if (payload.assigned_user_ids) {
      patch.assigned_user_ids = normalizeIdList(payload.assigned_user_ids);
    }

    if (payload.capacity !== undefined) {
      patch.capacity = Math.max(1, Number(payload.capacity) || 1);
    }

    return await db.update('duty_slots', slotId, patch);
  }

  async registerToSlot(slotId, user) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');
    if (slot.status === 'locked') throw ApiError.badRequest('Duty slot is locked');

    const userId = normalizeId(user.id || user);
    const assigned = normalizeIdList(slot.assigned_user_ids || []);

    if (assigned.includes(userId)) {
      throw ApiError.badRequest('You have already registered this duty slot');
    }

    const capacity = Math.max(1, Number(slot.capacity) || 1);
    if (assigned.length >= capacity) {
      throw ApiError.badRequest('Duty slot is full');
    }

    const sameDateSlots = await db.findMany('duty_slots', { shift_date: slot.shift_date });
    const hasConflict = sameDateSlots.some((item) => {
      if (normalizeId(item.id) === normalizeId(slot.id)) return false;
      const itemAssigned = normalizeIdList(item.assigned_user_ids || []);
      if (!itemAssigned.includes(userId)) return false;
      return (item.start_time || '') === (slot.start_time || '') && (item.end_time || '') === (slot.end_time || '');
    });

    if (hasConflict) {
      throw ApiError.badRequest('You already have another duty slot at this time');
    }

    const updated = await db.update('duty_slots', slot.id, {
      assigned_user_ids: [...assigned, userId],
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Đăng ký ca trực thành công',
      message: `Bạn đã đăng ký ca '${slot.shift_label}' ngày ${new Date(slot.shift_date).toLocaleDateString('vi-VN')}.`,
      category: 'shift',
      type: 'shift',
      ref_id: slot.id,
      metadata: { action: 'register' },
    });

    return updated;
  }

  async cancelRegistration(slotId, user) {
    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');

    const userId = normalizeId(user.id || user);
    const assigned = normalizeIdList(slot.assigned_user_ids || []);

    if (!assigned.includes(userId)) {
      throw ApiError.badRequest('You have not registered this duty slot');
    }

    const updated = await db.update('duty_slots', slot.id, {
      assigned_user_ids: assigned.filter((id) => id !== userId),
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Hủy ca trực thành công',
      message: `Bạn đã hủy ca '${slot.shift_label}' ngày ${new Date(slot.shift_date).toLocaleDateString('vi-VN')}.`,
      category: 'shift',
      type: 'shift',
      ref_id: slot.id,
      metadata: { action: 'cancel' },
    });

    return updated;
  }

  async requestSwap(payload, requesterUser) {
    const slotId = payload?.duty_slot_id || payload?.slotId;
    const targetUserIdRaw = payload?.target_user_id || payload?.targetUserId;
    const reason = String(payload?.reason || '').trim();

    if (!slotId || !targetUserIdRaw || !reason) {
      throw ApiError.badRequest('duty_slot_id, target_user_id and reason are required');
    }

    const requesterId = normalizeId(requesterUser.id);
    const targetUserId = normalizeId(targetUserIdRaw);

    if (requesterId === targetUserId) {
      throw ApiError.badRequest('Cannot swap duty slot with yourself');
    }

    const slot = await db.findById('duty_slots', slotId);
    if (!slot) throw ApiError.notFound('Duty slot not found');

    const assigned = normalizeIdList(slot.assigned_user_ids || []);
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
      duty_slot_id: normalizeId(slot.id),
      requester_id: requesterId,
      target_user_id: targetUserId,
      status: 'pending',
    });

    if (existingPending) {
      throw ApiError.badRequest('A pending swap request already exists for this slot and target user');
    }

    const now = new Date().toISOString();
    const created = await db.create('duty_swap_requests', {
      duty_slot_id: normalizeId(slot.id),
      requester_id: requesterId,
      target_user_id: targetUserId,
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
      message: `Yêu cầu đổi ca '${slot.shift_label}' của bạn đang chờ duyệt.`,
      category: 'approval',
      type: 'approval',
      ref_id: created.id,
      metadata: { action: 'swap_request_created' },
    });

    await notificationService.notifyUser(targetUserId, {
      title: 'Bạn có yêu cầu nhận ca trực',
      message: `Bạn vừa nhận được yêu cầu đổi ca '${slot.shift_label}'.`,
      category: 'approval',
      type: 'approval',
      ref_id: created.id,
      metadata: { action: 'swap_requested_to_you' },
    });

    await notificationService.notifyUsers(approverIds, {
      title: 'Yêu cầu duyệt đổi ca',
      message: `Có yêu cầu đổi ca mới cần duyệt cho ca '${slot.shift_label}'.`,
      category: 'approval',
      type: 'approval',
      ref_id: created.id,
      metadata: { action: 'swap_pending_review' },
    });

    return created;
  }

  async getSwapRequests(user, options = {}) {
    const userId = normalizeId(user.id);
    const isApprover = user.role === 'admin' || user.role === 'staff';

    if (isApprover) {
      return await db.findAllAdvanced('duty_swap_requests', {
        ...options,
        sort: options.sort || 'createdAt',
        order: options.order || 'desc',
      });
    }

    const requesterItems = await db.findMany('duty_swap_requests', { requester_id: userId });
    const targetItems = await db.findMany('duty_swap_requests', { target_user_id: userId });

    const map = new Map();
    for (const item of [...requesterItems, ...targetItems]) {
      map.set(item.id, item);
    }

    let merged = [...map.values()];

    const statusFilter = options?.filter?.status;
    if (statusFilter) {
      merged = merged.filter((item) => item.status === statusFilter);
    }

    merged.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return paginate(merged, options.page, options.limit);
  }

  async decideSwap(requestId, payload = {}, approverUser) {
    const swapRequest = await db.findById('duty_swap_requests', requestId);
    if (!swapRequest) throw ApiError.notFound('Swap request not found');

    if (swapRequest.status !== 'pending') {
      throw ApiError.badRequest(`Swap request is already ${swapRequest.status}`);
    }

    const decision = String(payload.decision || payload.status || '').toLowerCase();
    const note = String(payload.note || payload.reason || payload.decision_note || '').trim();

    if (!['approved', 'rejected'].includes(decision)) {
      throw ApiError.badRequest("decision must be 'approved' or 'rejected'");
    }

    const now = new Date().toISOString();

    if (decision === 'approved') {
      const slot = await db.findById('duty_slots', swapRequest.duty_slot_id);
      if (!slot) throw ApiError.notFound('Duty slot not found');

      const requesterId = normalizeId(swapRequest.requester_id);
      const targetUserId = normalizeId(swapRequest.target_user_id);
      const assigned = normalizeIdList(slot.assigned_user_ids || []);

      if (!assigned.includes(requesterId)) {
        throw ApiError.badRequest('Requester is no longer assigned to this duty slot');
      }

      if (assigned.includes(targetUserId)) {
        throw ApiError.badRequest('Target user is already assigned to this duty slot');
      }

      const nextAssigned = [...assigned.filter((id) => id !== requesterId), targetUserId];
      await db.update('duty_slots', slot.id, {
        assigned_user_ids: nextAssigned,
        updatedAt: now,
      });
    }

    const updatedRequest = await db.update('duty_swap_requests', requestId, {
      status: decision,
      decision_note: note,
      approved_by: normalizeId(approverUser.id),
      approved_at: now,
      updatedAt: now,
    });

    if (decision === 'approved') {
      await notificationService.notifyUser(swapRequest.requester_id, {
        title: 'Yêu cầu đổi ca đã được duyệt',
        message: 'Yêu cầu đổi ca của bạn đã được chấp thuận.',
        category: 'approval',
        type: 'approval',
        ref_id: swapRequest.id,
        metadata: { decision: 'approved' },
      });

      await notificationService.notifyUser(swapRequest.target_user_id, {
        title: 'Bạn đã được phân ca mới',
        message: 'Yêu cầu đổi ca đã được duyệt và ca trực đã được cập nhật cho bạn.',
        category: 'approval',
        type: 'approval',
        ref_id: swapRequest.id,
        metadata: { decision: 'approved' },
      });
    } else {
      await notificationService.notifyUser(swapRequest.requester_id, {
        title: 'Yêu cầu đổi ca bị từ chối',
        message: note || 'Yêu cầu đổi ca của bạn đã bị từ chối.',
        category: 'approval',
        type: 'approval',
        ref_id: swapRequest.id,
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
      totalAssigned: slots.reduce((acc, s) => acc + (s.assigned_user_ids?.length || 0), 0),
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
