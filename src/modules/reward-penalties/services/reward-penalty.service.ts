import BaseService from '@shared/common/base-service';
import rewardPenaltiesRepository from '@modules/reward-penalties/repositories/reward-penalties.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import ApiError from '@utils/api-error';
import notificationService from '@modules/notifications/services/notification.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import type { AnyRecord, Identifier } from '@app-types/common';

function normalizeId(id: any): Identifier {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

function toIsoDate(value: any, fallback: string | null = null) {
  if (!value && fallback) return fallback;
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

class RewardPenaltyService extends BaseService {
  constructor() {
    super('reward_penalties', rewardPenaltiesRepository);
  }

  async updateEntry(id: Identifier, payload: AnyRecord = {}, actorId: Identifier) {
    const entryId = normalizeId(id);
    const existing = await this.repository.findById(entryId);
    if (!existing) throw ApiError.notFound('Không tìm thấy bản ghi thưởng/phạt');

    const nextPayload: AnyRecord = {};
    const targetUserId = normalizeId(payload.userId ?? existing.userId);
    if (!targetUserId) throw ApiError.badRequest('userId là bắt buộc');

    const user = await usersRepository.findById(targetUserId);
    if (!user) throw ApiError.notFound('Không tìm thấy người dùng');

    if (payload.userId !== undefined) {
      nextPayload.userId = targetUserId;
    }

    const type = String(payload.type ?? existing.type ?? '').toLowerCase();
    if (!['reward', 'penalty'].includes(type)) {
      throw ApiError.badRequest("type phải là 'reward' hoặc 'penalty'");
    }
    if (payload.type !== undefined) {
      nextPayload.type = type;
    }

    const amount = payload.amount !== undefined ? Number(payload.amount) : Number(existing.amount);
    if (Number.isNaN(amount) || amount < 0) {
      throw ApiError.badRequest('amount phải là số không âm');
    }
    if (payload.amount !== undefined) {
      nextPayload.amount = amount;
    }

    const reason =
      payload.reason !== undefined ? String(payload.reason || '').trim() : String(existing.reason || '').trim();
    if (!reason) {
      throw ApiError.badRequest('reason là bắt buộc');
    }
    if (payload.reason !== undefined) {
      nextPayload.reason = reason;
    }

    if (payload.eventDate !== undefined) {
      const eventDate = toIsoDate(payload.eventDate);
      if (!eventDate) {
        throw ApiError.badRequest('eventDate không hợp lệ');
      }
      nextPayload.eventDate = eventDate;
    }

    if (payload.note !== undefined) {
      nextPayload.note = payload.note || '';
    }

    if (Object.keys(nextPayload).length === 0) {
      throw ApiError.badRequest('Không có dữ liệu để cập nhật');
    }

    const now = new Date().toISOString();
    const updated = await this.repository.update(entryId, {
      ...nextPayload,
      updatedAt: now,
    });

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'CẬP NHẬT THƯỞNG/PHẠT',
      module: 'REWARD_PENALTIES',
      description: `${type === 'reward' ? 'Cập nhật thưởng' : 'Cập nhật phạt'} cho người dùng #${targetUserId}`,
      resourceId: String(entryId),
    });

    await notificationService.notifyUser(targetUserId, {
      title: 'Thông tin thưởng/phạt được cập nhật',
      message:
        type === 'reward'
          ? `Mức thưởng của bạn đã được cập nhật thành ${amount.toLocaleString('vi-VN')} VNĐ.`
          : `Mức phạt của bạn đã được cập nhật thành ${amount.toLocaleString('vi-VN')} VNĐ.`,
      category: 'system',
      type: 'system',
      refId: entryId,
      metadata: { type, amount, reason },
    });

    return updated;
  }

  async createEntry(payload: AnyRecord = {}, actorId: Identifier) {
    const userId = normalizeId(payload.userId);
    if (!userId) throw ApiError.badRequest('userId is required');

    const user = await usersRepository.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const type = String(payload.type || '').toLowerCase();
    if (!['reward', 'penalty'].includes(type)) {
      throw ApiError.badRequest("type must be 'reward' or 'penalty'");
    }

    const amount = Number(payload.amount);
    if (Number.isNaN(amount) || amount < 0) {
      throw ApiError.badRequest('amount must be a non-negative number');
    }

    const reason = String(payload.reason || '').trim();
    if (!reason) {
      throw ApiError.badRequest('reason is required');
    }

    const now = new Date().toISOString();
    const created = await this.repository.create({
      userId,
      type,
      amount,
      reason,
      eventDate: toIsoDate(payload.eventDate, now),
      createdBy: normalizeId(actorId),
      note: payload.note || '',
      createdAt: now,
      updatedAt: now,
    });

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM THƯỞNG/PHẠT',
      module: 'REWARD_PENALTIES',
      description: `${type === 'reward' ? 'Tạo thưởng' : 'Tạo phạt'} cho người dùng #${userId}`,
      resourceId: String(created.id),
    });

    await notificationService.notifyUser(userId, {
      title: type === 'reward' ? 'Bạn vừa được thưởng' : 'Bạn vừa nhận mức phạt',
      message:
        type === 'reward'
          ? `Bạn vừa được thưởng ${amount.toLocaleString('vi-VN')} VNĐ.`
          : `Bạn vừa nhận mức phạt ${amount.toLocaleString('vi-VN')} VNĐ.`,
      category: 'system',
      type: 'system',
      refId: created.id,
      metadata: { type, amount, reason },
    });

    return created;
  }

  async getHistory(user: AnyRecord, options: AnyRecord = {}) {
    const isManager = user.role === 'admin' || user.role === 'staff';
    const userId = normalizeId(user.id);

    const filter: AnyRecord = { ...(options.filter || {}) };
    if (!isManager) {
      filter.userId = userId;
    }

    return await rewardPenaltiesRepository.findAllAdvanced({
      ...options,
      filter,
      sort: options.sort || 'eventDate,createdAt',
      order: options.order || 'desc',
    });
  }

  async getFinancialStats(options: AnyRecord = {}) {
    const all = await this.repository.findAll();

    const fromDate = toIsoDate(options.from || options.dateFrom || options?.filter?.eventDate_gte);
    const toDate = toIsoDate(options.to || options.dateTo || options?.filter?.eventDate_lte);

    const items = all.filter((item) => {
      const eventDate = toIsoDate(item.eventDate || item.createdAt, item.createdAt);
      if (!eventDate) return false;
      if (fromDate && eventDate < fromDate) return false;
      if (toDate && eventDate > toDate) return false;
      return true;
    });

    let totalReward = 0;
    let totalPenalty = 0;
    const byMonth: AnyRecord = {};

    for (const item of items) {
      const amount = Number(item.amount) || 0;
      const monthKey = String(item.eventDate || item.createdAt || '').slice(0, 7);

      if (!byMonth[monthKey]) {
        byMonth[monthKey] = { reward: 0, penalty: 0, net: 0 };
      }

      if (item.type === 'reward') {
        totalReward += amount;
        byMonth[monthKey].reward += amount;
      } else {
        totalPenalty += amount;
        byMonth[monthKey].penalty += amount;
      }

      byMonth[monthKey].net = byMonth[monthKey].reward - byMonth[monthKey].penalty;
    }

    return {
      totalItems: items.length,
      totalReward,
      totalPenalty,
      netBalance: totalReward - totalPenalty,
      byMonth,
    };
  }
}

export default new RewardPenaltyService();
