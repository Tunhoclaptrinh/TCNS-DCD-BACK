import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';

const DEFAULT_SETTINGS = {
  shift_notifications: true,
  approval_notifications: true,
  system_notifications: true,
  email_notifications: false,
  sms_notifications: false,
};

type Identifier = number | string;
type NotificationPayload = Record<string, any>;
type NotificationOptions = {
  force?: boolean;
};

function normalizeId(id: unknown): Identifier {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? (id as Identifier) : parsed;
}

class NotificationService extends BaseService {
  constructor() {
    super('notifications');
  }

  async getSettings(userId: Identifier) {
    const normalizedUserId = normalizeId(userId);
    let settings = await db.findOne('notification_settings', { user_id: normalizedUserId });

    if (!settings) {
      settings = await db.create('notification_settings', {
        user_id: normalizedUserId,
        ...DEFAULT_SETTINGS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    return settings;
  }

  async updateSettings(userId: Identifier, payload: Record<string, any> = {}) {
    const settings = await this.getSettings(userId);
    const allowedKeys = Object.keys(DEFAULT_SETTINGS);
    const updateData: Record<string, boolean> = {};

    for (const key of allowedKeys) {
      if (payload[key] === undefined) continue;
      updateData[key] = payload[key] === true || payload[key] === 'true' || payload[key] === 1 || payload[key] === '1';
    }

    if (Object.keys(updateData).length === 0) {
      return settings;
    }

    const updated = await db.update('notification_settings', settings.id, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });
    return updated;
  }

  isCategoryEnabled(settings: Record<string, any>, category: string) {
    if (!settings) return true;
    if (category === 'shift') return settings.shift_notifications !== false;
    if (category === 'approval') return settings.approval_notifications !== false;
    return settings.system_notifications !== false;
  }

  async notifyUser(userId: Identifier, payload: NotificationPayload = {}, options: NotificationOptions = {}) {
    const normalizedUserId = normalizeId(userId);
    const category = payload.category || 'system';
    const force = options.force === true;

    if (!force) {
      const settings = await this.getSettings(normalizedUserId);
      if (!this.isCategoryEnabled(settings, category)) {
        return { skipped: true };
      }
    }

    return await db.create('notifications', {
      user_id: normalizedUserId,
      title: payload.title || 'Thông báo',
      message: payload.message || '',
      type: payload.type || (category === 'approval' ? 'approval' : category === 'shift' ? 'shift' : 'system'),
      category,
      channel: payload.channel || 'in_app',
      ref_id: payload.ref_id || null,
      metadata: payload.metadata || null,
      is_read: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async notifyUsers(userIds: Identifier[] = [], payload: NotificationPayload = {}, options: NotificationOptions = {}) {
    const uniqueUserIds = [
      ...new Set(userIds.map((id) => normalizeId(id)).filter((id) => id !== null && id !== undefined)),
    ];
    const created = [];

    for (const userId of uniqueUserIds) {
      const item = await this.notifyUser(userId, payload, options);
      created.push(item);
    }

    return created;
  }

  async getNotifications(userId: Identifier, options: Record<string, any> = {}) {
    const normalizedUserId = normalizeId(userId);
    const result = await db.findAllAdvanced('notifications', {
      ...options,
      filter: {
        ...options.filter,
        user_id: normalizedUserId,
      },
      sort: 'createdAt',
      order: 'desc',
    });

    const unreadCount = await db.count('notifications', {
      user_id: normalizedUserId,
      is_read: false,
    });

    return {
      data: result.data,
      unreadCount,
      pagination: result.pagination,
    };
  }

  async markAsRead(notificationId: Identifier, userId: Identifier) {
    const notification = await db.findById('notifications', notificationId);
    const normalizedUserId = normalizeId(userId);

    if (!notification || normalizeId(notification.user_id) !== normalizedUserId) {
      throw ApiError.notFound('Notification not found');
    }

    return await db.update('notifications', notificationId, { is_read: true });
  }

  async markAllAsRead(userId: Identifier) {
    const normalizedUserId = normalizeId(userId);
    const unreadNotifications = await db.findMany('notifications', {
      user_id: normalizedUserId,
      is_read: false,
    });

    await Promise.all(unreadNotifications.map((n) => db.update('notifications', n.id, { is_read: true })));

    return { message: 'All notifications marked as read', count: unreadNotifications.length };
  }

  async deleteForUser(notificationId: Identifier, userId: Identifier) {
    const notification = await db.findById('notifications', notificationId);
    const normalizedUserId = normalizeId(userId);

    if (!notification || normalizeId(notification.user_id) !== normalizedUserId) {
      throw ApiError.notFound('Notification not found');
    }

    return await super.delete(notificationId);
  }

  async deleteAll(userId: Identifier) {
    const normalizedUserId = normalizeId(userId);
    const userNotifications = await db.findMany('notifications', { user_id: normalizedUserId });

    await Promise.all(userNotifications.map((n) => db.delete('notifications', n.id)));

    return { message: 'All notifications deleted', count: userNotifications.length };
  }
}

export default new NotificationService();
