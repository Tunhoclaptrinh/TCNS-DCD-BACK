import BaseService from '@utils/base-service';
import db from '@config/database';
import { sanitizeUser, hashPassword } from '@utils/helpers';
import ApiError from '@utils/api-error';
import userSchema from '@schemas/user.schema';
import notificationService from '@services/common/notification.service';

function generateAvatarUrl(name) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

class UserService extends BaseService {
  constructor() {
    super('users');
  }

  getSchema() {
    return userSchema;
  }

  async transformImportData(data) {
    const transformed = await super.transformImportData(data);

    if (transformed.password) {
      transformed.password = await hashPassword(transformed.password);
    }

    if (!transformed.avatar && transformed.name) {
      transformed.avatar = generateAvatarUrl(transformed.name);
    }

    return transformed;
  }

  async beforeCreate(data) {
    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    if (data.firstName || data.lastName) {
      data.name = `${data.lastName || ''} ${data.firstName || ''}`.trim();
    }

    if (!data.avatar && data.name) {
      data.avatar = generateAvatarUrl(data.name);
    }

    return {
      ...data,
      isActive: data.isActive !== undefined ? data.isActive : true,
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async beforeUpdate(id, data) {
    if (data.newPassword) {
      data.password = await hashPassword(data.newPassword);
      delete data.newPassword;
    } else if (data.password) {
      data.password = await hashPassword(data.password);
    }

    if (data.firstName || data.lastName) {
      const current = await db.findById('users', id);
      const lastName = data.lastName !== undefined ? data.lastName : current.lastName;
      const firstName = data.firstName !== undefined ? data.firstName : current.firstName;
      data.name = `${lastName || ''} ${firstName || ''}`.trim();
    }

    return {
      ...data,
      updatedAt: new Date().toISOString(),
    };
  }

  async getUserStats() {
    const users = await db.findAll('users');
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const createUserStatItem = () => ({
      total: 0,
      active: 0,
      inactive: 0,
      dismissed: 0,
      ctv: 0,
      official: 0,
      management: 0,
      recentSignups: 0,
      byRole: {},
      byPosition: {},
    });

    const stats = {
      global: createUserStatItem(),
      byDepartment: {},
    };

    const processUser = (item, user) => {
      item.total++;
      if (user.status === 'active') item.active++;
      else if (user.status === 'inactive') item.inactive++;
      else if (user.status === 'dismissed') item.dismissed++;

      // CTV: tvb, Official: tv, Management: ctc
      if (user.position === 'tvb') item.ctv++;
      else if (user.position === 'tv') item.official++;
      else if (user.position === 'ctc') item.management++;

      if (new Date(user.createdAt) >= weekAgo) item.recentSignups++;

      if (user.role) {
        item.byRole[user.role] = (item.byRole[user.role] || 0) + 1;
      }
      if (user.position) {
        item.byPosition[user.position] = (item.byPosition[user.position] || 0) + 1;
      }
    };

    for (const user of users) {
      // Global stats
      processUser(stats.global, user);

      // Department stats
      if (user.department) {
        if (!stats.byDepartment[user.department]) {
          stats.byDepartment[user.department] = createUserStatItem();
        }
        processUser(stats.byDepartment[user.department], user);
      }
    }

    return stats;
  }

  async getUserActivity(userId) {
    const user = await db.findById('users', userId);
    if (!user) throw ApiError.notFound('User not found');

    return {
      user: sanitizeUser(user),
      joinedAt: user.createdAt,
      lastLogin: user.lastLogin,
    };
  }

  async toggleUserStatus(userId) {
    const user = await db.findById('users', userId);
    if (!user) throw ApiError.notFound('User not found');

    const updated = await db.update('users', userId, {
      isActive: !user.isActive,
      updatedAt: new Date().toISOString(),
    });

    return sanitizeUser(updated);
  }

  async promoteUser(userId, role, reason, actorId, actorRole) {
    const allowedRoles = ['customer', 'staff', 'admin'];
    if (!allowedRoles.includes(role)) {
      throw ApiError.badRequest(`Invalid role. Allowed roles: ${allowedRoles.join(', ')}`);
    }

    const user = await db.findById('users', userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.expelled) throw ApiError.badRequest('Cannot promote expelled user');
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Cannot change your own role');

    if (actorRole !== 'admin') {
      if (role === 'admin') {
        throw ApiError.forbidden('Only admin can assign admin role');
      }
      if (user.role === 'admin') {
        throw ApiError.forbidden('Only admin can change admin role');
      }
    }

    const now = new Date().toISOString();
    const updated = await db.update('users', userId, {
      role,
      promotedAt: now,
      promotedBy: actorId,
      promotionReason: reason || '',
      updatedAt: now,
    });

    await notificationService.notifyUser(user.id, {
      title: 'Cập nhật chức vụ',
      message: `Chức vụ của bạn đã được cập nhật thành '${role}'.`,
      type: 'system',
      category: 'system',
      metadata: {
        role,
        reason: reason || '',
      },
    });

    return sanitizeUser(updated);
  }

  async expelUser(userId, reason, actorId, actorRole) {
    const user = await db.findById('users', userId);
    if (!user) throw ApiError.notFound('User not found');
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Cannot expel your own account');

    if (actorRole !== 'admin' && user.role === 'admin') {
      throw ApiError.forbidden('Only admin can expel admin account');
    }

    if (user.expelled) {
      return sanitizeUser(user);
    }

    const now = new Date().toISOString();
    const updated = await db.update('users', userId, {
      expelled: true,
      expelledAt: now,
      expelReason: reason || '',
      expelledBy: actorId,
      isActive: false,
      updatedAt: now,
    });

    await notificationService.notifyUser(user.id, {
      title: 'Thông báo khai trừ',
      message: 'Tài khoản của bạn đã bị khai trừ khỏi tổ chức.',
      type: 'approval',
      category: 'approval',
      metadata: {
        reason: reason || '',
      },
    });

    return sanitizeUser(updated);
  }

  async permanentDeleteUser(userId, actorId, actorRole) {
    const user = await db.findById('users', userId);
    if (!user) throw ApiError.notFound('User not found');
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Cannot delete your own account');

    if (actorRole !== 'admin' && user.role === 'admin') {
      throw ApiError.forbidden('Only admin can delete admin account');
    }

    const parsedUserId = Number(userId);
    const normalizedUserId = Number.isNaN(parsedUserId) ? userId : parsedUserId;

    const notifications = await db.findMany('notifications', { userId: normalizedUserId });
    const notificationSettings = await db.findMany('notification_settings', { userId: normalizedUserId });
    const rewardPenaltiesByUser = await db.findMany('reward_penalties', { userId: normalizedUserId });
    const rewardPenaltiesByCreator = await db.findMany('reward_penalties', { createdBy: normalizedUserId });
    const swapByRequester = await db.findMany('duty_swap_requests', { requesterId: normalizedUserId });
    const swapByTarget = await db.findMany('duty_swap_requests', { targetUserId: normalizedUserId });
    const swapByApprover = await db.findMany('duty_swap_requests', { approvedBy: normalizedUserId });
    const dutySlots = await db.findAll('duty_slots');

    await Promise.all(notifications.map((n) => db.delete('notifications', n.id)));
    await Promise.all(notificationSettings.map((n) => db.delete('notification_settings', n.id)));

    const rewardPenaltyMap = new Map();
    for (const item of [...rewardPenaltiesByUser, ...rewardPenaltiesByCreator]) {
      rewardPenaltyMap.set(item.id, item);
    }
    await Promise.all([...rewardPenaltyMap.values()].map((item) => db.delete('reward_penalties', item.id)));

    const swapMap = new Map();
    for (const item of [...swapByRequester, ...swapByTarget, ...swapByApprover]) {
      swapMap.set(item.id, item);
    }
    await Promise.all([...swapMap.values()].map((item) => db.delete('duty_swap_requests', item.id)));

    const slotUpdates = dutySlots
      .map((slot) => {
        const assignedUserIds = Array.isArray(slot.assignedUserIds) ? slot.assignedUserIds : [];
        const filtered = assignedUserIds.filter((id) => Number(id) !== Number(normalizedUserId));
        if (filtered.length === assignedUserIds.length) {
          return null;
        }
        return db.update('duty_slots', slot.id, {
          assignedUserIds: filtered,
          updatedAt: new Date().toISOString(),
        });
      })
      .filter(Boolean);

    if (slotUpdates.length > 0) {
      await Promise.all(slotUpdates);
    }

    await db.delete('users', userId);

    return { user: 1, notifications: notifications.length };
  }
}

export default new UserService();
