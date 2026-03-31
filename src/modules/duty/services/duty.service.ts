import BaseService from '@shared/common/base-service';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import ApiError from '@utils/api-error';
import notificationService from '@modules/notifications/services/notification.service';

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

function getActorId(user: DutyUser): Identifier {
  return normalizeId(user.id);
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

    const result = await dutySlotsRepository.findAllAdvanced({
      ...options,
      filter: {
        ...(options.filter || {}),
        shiftDate_gte: weekStart,
        shiftDate_lte: weekEnd,
      },
      sort: options.sort || 'shiftDate,startTime',
      order: options.order || 'asc',
    });

    const users = (await usersRepository.findAll()) as DutyUser[];
    const userMap = this.buildScheduleUserMap(users);

    const data = result.data.map((slot) => {
      const assignedUserIds = this.getAssignedUserIds(slot as DutySlotRecord);
      return {
        ...slot,
        assignedUserIds,
        assignedUsers: assignedUserIds
          .map((id) => userMap.get(id))
          .filter(Boolean)
          .map((user) => ({ id: user.id, name: user.name, role: user.role, avatar: user.avatar })),
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
    const created = await this.repository.create(slotPayload);
    return created;
  }

  async updateSlot(slotId: Identifier, payload: GenericRecord = {}) {
    const slot = await this.repository.findById(slotId);
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

    return await this.repository.update(slotId, patch);
  }

  async registerToSlot(slotId: Identifier, user: DutyUser) {
    const slot = await this.findSlotOrThrow(slotId);
    if (slot.status === 'locked') throw ApiError.badRequest('Duty slot is locked');

    const userId = getActorId(user);
    const assigned = this.getAssignedUserIds(slot);

    if (assigned.includes(userId)) {
      throw ApiError.badRequest('You have already registered this duty slot');
    }

    const capacity = this.getSlotCapacity(slot);
    if (assigned.length >= capacity) {
      throw ApiError.badRequest('Duty slot is full');
    }

    const sameDateSlots = await dutySlotsRepository.findByShiftDate(slot.shiftDate);
    const hasConflict = sameDateSlots.some((item) => {
      if (normalizeId(item.id) === normalizeId(slot.id)) return false;
      const itemAssigned = this.getAssignedUserIds(item as DutySlotRecord);
      if (!itemAssigned.includes(userId)) return false;
      return (item.startTime || '') === (slot.startTime || '') && (item.endTime || '') === (slot.endTime || '');
    });

    if (hasConflict) {
      throw ApiError.badRequest('You already have another duty slot at this time');
    }

    const updated = await this.saveAssignedUsers(slot.id, [...assigned, userId]);
    await this.notifySlotAssignment(userId, slot, 'register');

    return updated;
  }

  async cancelRegistration(slotId: Identifier, user: DutyUser) {
    const slot = await this.findSlotOrThrow(slotId);

    const userId = getActorId(user);
    const assigned = this.getAssignedUserIds(slot);

    if (!assigned.includes(userId)) {
      throw ApiError.badRequest('You have not registered this duty slot');
    }

    const updated = await this.saveAssignedUsers(
      slot.id,
      assigned.filter((id) => id !== userId),
    );
    await this.notifySlotAssignment(userId, slot, 'cancel');

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

    const slot = await this.findSlotOrThrow(slotId);

    const assigned = this.getAssignedUserIds(slot);
    if (!assigned.includes(requesterId)) {
      throw ApiError.badRequest('You are not assigned to this duty slot');
    }

    if (assigned.includes(targetUserId)) {
      throw ApiError.badRequest('Target user is already assigned to this duty slot');
    }

    const targetUser = await usersRepository.findById(targetUserId);
    if (!targetUser || !targetUser.isActive) {
      throw ApiError.badRequest('Target user is invalid or inactive');
    }

    const existingPending = await dutySwapRequestsRepository.findPendingBySlotAndParticipants(
      normalizeId(slot.id),
      requesterId,
      targetUserId,
    );

    if (existingPending) {
      throw ApiError.badRequest('A pending swap request already exists for this slot and target user');
    }

    const now = new Date().toISOString();
    const created = await dutySwapRequestsRepository.create({
      dutySlotId: normalizeId(slot.id),
      requesterId,
      targetUserId,
      reason,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });

    const allUsers = (await usersRepository.findAll()) as DutyUser[];
    const approverIds = this.getApproverIds(allUsers);

    await this.notifySwapRequestCreated(slot, created.id, requesterId, targetUserId, approverIds);

    return created;
  }

  async getSwapRequests(user: GenericRecord, options: GenericRecord = {}) {
    const userId = normalizeId(user.id);
    const isApprover = user.role === 'admin' || user.role === 'staff';

    if (isApprover) {
      return await dutySwapRequestsRepository.findAllAdvanced({
        ...options,
        sort: options.sort || 'createdAt',
        order: options.order || 'desc',
      });
    }

    const requesterItems = await dutySwapRequestsRepository.findMany({ requesterId: userId });
    const targetItems = await dutySwapRequestsRepository.findMany({ targetUserId: userId });

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
    const swapRequest = (await dutySwapRequestsRepository.findById(requestId)) as DutySwapRequestRecord | null;
    if (!swapRequest) throw ApiError.notFound('Swap request not found');

    if (swapRequest.status !== 'pending') {
      throw ApiError.badRequest(`Swap request is already ${swapRequest.status}`);
    }

    const { decision, note } = this.parseSwapDecision(payload);

    const now = new Date().toISOString();

    if (decision === 'approved') {
      await this.applyApprovedSwapRequest(swapRequest, now);
    }

    const updatedRequest = await dutySwapRequestsRepository.update(requestId, {
      status: decision,
      decisionNote: note,
      approvedBy: normalizeId(approverUser.id),
      approvedAt: now,
      updatedAt: now,
    });

    await this.notifySwapDecision(swapRequest, decision, note);

    return updatedRequest;
  }

  async getStats() {
    const slots = await this.repository.findAll();
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
