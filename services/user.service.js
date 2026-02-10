const BaseService = require('../utils/BaseService');
const db = require('../config/database');
const { sanitizeUser, hashPassword } = require('../utils/helpers');
const userSchema = require('../schemas/user.schema');

class UserService extends BaseService {
  constructor() {
    super('users');
  }

  /**
   * Get schema for import/export
   */
  getSchema() {
    return userSchema;
  }

  /**
   * Transform import data - hash password
   */
  async transformImportData(data) {
    const transformed = await super.transformImportData(data);

    // Hash password if provided
    if (transformed.password) {
      transformed.password = await hashPassword(transformed.password);
    }

    // Generate avatar if not provided
    if (!transformed.avatar && transformed.name) {
      transformed.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(transformed.name)}&background=random`;
    }

    return transformed;
  }

  async beforeCreate(data) {
    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    // Generate avatar if not provided
    if (!data.avatar && data.name) {
      data.avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=random`;
    }

    return {
      ...data,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async beforeUpdate(id, data) {
    if (data.newPassword) {
      data.password = await hashPassword(data.newPassword);
      delete data.newPassword;
    }

    // Hash password if provided directly (for admin updates)
    if (data.password) {
      data.password = await hashPassword(data.password);
    }

    return {
      ...data,
      updatedAt: new Date().toISOString()
    };
  }

  async getUserStats() {
    const users = await db.findAll('users');

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats = {
      total: users.length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
      byRole: {
        customer: users.filter(u => u.role === 'customer').length,
        admin: users.filter(u => u.role === 'admin').length,
        researcher: users.filter(u => u.role === 'researcher').length
      },
      recentSignups: users.filter(u => {
        const createdAt = new Date(u.createdAt);
        return createdAt >= weekAgo;
      }).length
    };

    return {
      success: true,
      data: stats
    };
  }

  async getUserActivity(userId) {
    const user = await db.findById('users', userId);

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        statusCode: 404
      };
    }

    // In a generic base, we might only show basic info or notifications
    // You can extend this with generic login history if implemented later
    const activity = {
      user: sanitizeUser(user),
      joinedAt: user.createdAt,
      lastLogin: user.lastLogin
    };

    return {
      success: true,
      data: activity
    };
  }

  async toggleUserStatus(userId) {
    const user = await db.findById('users', userId);

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        statusCode: 404
      };
    }

    const updated = await db.update('users', userId, {
      isActive: !user.isActive,
      updatedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: `User ${updated.isActive ? 'activated' : 'deactivated'} successfully`,
      data: sanitizeUser(updated)
    };
  }

  async permanentDeleteUser(userId) {
    const user = await db.findById('users', userId);

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        statusCode: 404
      };
    }

    // Delete relationships (Generic)
    // Add any other generic relationships here (e.g. notifications)
    const notifications = await db.findMany('notifications', { user_id: userId });
    for (const notif of notifications) {
      await db.delete('notifications', notif.id);
    }

    // Finally delete user
    await db.delete('users', userId);

    return {
      success: true,
      message: 'Permanently deleted user and related data',
      deleted: {
        user: 1,
        notifications: notifications.length
      }
    };
  }
}

module.exports = new UserService();