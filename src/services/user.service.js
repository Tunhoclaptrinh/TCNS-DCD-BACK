import BaseService from '@utils/base-service';
import db from '@config/database';
import { sanitizeUser, hashPassword } from '@utils/helpers';
import ApiError from '@utils/api-error';
import userSchema from '@schemas/user.schema';

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

    if (!data.avatar && data.name) {
      data.avatar = generateAvatarUrl(data.name);
    }

    return {
      ...data,
      isActive: data.isActive !== undefined ? data.isActive : true,
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

    return {
      ...data,
      updatedAt: new Date().toISOString(),
    };
  }

  async getUserStats() {
    const users = await db.findAll('users');

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = { total: users.length, active: 0, inactive: 0, byRole: {}, recentSignups: 0 };

    for (const user of users) {
      if (user.isActive) stats.active++;
      else stats.inactive++;

      stats.byRole[user.role] = (stats.byRole[user.role] || 0) + 1;

      if (new Date(user.createdAt) >= weekAgo) stats.recentSignups++;
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

  async permanentDeleteUser(userId) {
    const user = await db.findById('users', userId);
    if (!user) throw ApiError.notFound('User not found');

    const notifications = await db.findMany('notifications', { user_id: userId });
    await Promise.all(notifications.map((n) => db.delete('notifications', n.id)));
    await db.delete('users', userId);

    return { user: 1, notifications: notifications.length };
  }
}

export default new UserService();
