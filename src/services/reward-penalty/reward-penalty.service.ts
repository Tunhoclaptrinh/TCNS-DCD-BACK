import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';
import notificationService from '@services/notification/notification.service';
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
    super('reward_penalties');
  }

  async createEntry(payload: AnyRecord = {}, actorId: Identifier) {
    const userId = normalizeId(payload.userId);
    if (!userId) throw ApiError.badRequest('userId is required');

    const user = await db.findById('users', userId);
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
    const created = await db.create('reward_penalties', {
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

    return await db.findAllAdvanced('reward_penalties', {
      ...options,
      filter,
      sort: options.sort || 'eventDate,createdAt',
      order: options.order || 'desc',
    });
  }

  async getFinancialStats(options: AnyRecord = {}) {
    const all = await db.findAll('reward_penalties');

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
