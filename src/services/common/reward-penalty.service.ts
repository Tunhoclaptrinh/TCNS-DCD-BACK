import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';
import notificationService from '@services/common/notification.service';
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
    const userId = normalizeId(payload.user_id || payload.userId);
    if (!userId) throw ApiError.badRequest('user_id is required');

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
      user_id: userId,
      type,
      amount,
      reason,
      event_date: toIsoDate(payload.event_date || payload.eventDate, now),
      created_by: normalizeId(actorId),
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
      ref_id: created.id,
      metadata: { type, amount, reason },
    });

    return created;
  }

  async getHistory(user: AnyRecord, options: AnyRecord = {}) {
    const isManager = user.role === 'admin' || user.role === 'staff';
    const userId = normalizeId(user.id);

    const filter: AnyRecord = { ...(options.filter || {}) };
    if (!isManager) {
      filter.user_id = userId;
    }

    return await db.findAllAdvanced('reward_penalties', {
      ...options,
      filter,
      sort: options.sort || 'event_date,createdAt',
      order: options.order || 'desc',
    });
  }

  async getFinancialStats(options: AnyRecord = {}) {
    const all = await db.findAll('reward_penalties');

    const fromDate = toIsoDate(options.from || options.date_from || options?.filter?.event_date_gte);
    const toDate = toIsoDate(options.to || options.date_to || options?.filter?.event_date_lte);

    const items = all.filter((item) => {
      const eventDate = toIsoDate(item.event_date || item.createdAt, item.createdAt);
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
      const monthKey = String(item.event_date || item.createdAt || '').slice(0, 7);

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
