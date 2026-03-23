import BaseService from 'src/common/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';

const DEFAULT_SETTINGS = {
  shiftNotifications: true,
  approvalNotifications: true,
  systemNotifications: true,
  emailNotifications: false,
  smsNotifications: false,
};

type Identifier = number | string;
type NotificationPayload = Record<string, any>;
type NotificationOptions = {
  force?: boolean;
};

const CATEGORY_TO_SETTING_KEY: Record<string, keyof typeof DEFAULT_SETTINGS> = {
  shift: 'shiftNotifications',
  approval: 'approvalNotifications',
  system: 'systemNotifications',
};

function deriveNotificationTypeFromCategory(category: string | undefined) {
  // Keep same behavior: approval -> approval, shift -> shift, everything else -> system.
  if (category === 'approval') return 'approval';
  if (category === 'shift') return 'shift';
  return 'system';
}

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
    const now = new Date().toISOString();
    let settings = await db.findOne('notification_settings', { userId: normalizedUserId });

    if (!settings) {
      settings = await db.create('notification_settings', {
        userId: normalizedUserId,
        ...DEFAULT_SETTINGS,
        createdAt: now,
        updatedAt: now,
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

    const now = new Date().toISOString();
    const updated = await db.update('notification_settings', settings.id, {
      ...updateData,
      updatedAt: now,
    });
    return updated;
  }

  isCategoryEnabled(settings: Record<string, any>, category: string) {
    if (!settings) return true;
    const settingKey = CATEGORY_TO_SETTING_KEY[category] ?? 'systemNotifications';
    return settings[settingKey] !== false;
  }

  async notifyUser(userId: Identifier, payload: NotificationPayload = {}, options: NotificationOptions = {}) {
    const normalizedUserId = normalizeId(userId);
    const category = payload.category || 'system';
    const force = options.force === true;
    const derivedType = deriveNotificationTypeFromCategory(category);

    if (!force) {
      const settings = await this.getSettings(normalizedUserId);
      if (!this.isCategoryEnabled(settings, category)) {
        return { skipped: true };
      }
    }

    return await db.create('notifications', {
      userId: normalizedUserId,
      title: payload.title || 'Thông báo',
      message: payload.message || '',
      type: payload.type || derivedType,
      category,
      channel: payload.channel || 'in_app',
      refId: payload.refId || null,
      metadata: payload.metadata || null,
      isRead: false,
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
        userId: normalizedUserId,
      },
      sort: 'createdAt',
      order: 'desc',
    });

    const unreadCount = await db.count('notifications', {
      userId: normalizedUserId,
      isRead: false,
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

    if (!notification || normalizeId(notification.userId) !== normalizedUserId) {
      throw ApiError.notFound('Notification not found');
    }

    return await db.update('notifications', notificationId, { isRead: true });
  }

  async markAllAsRead(userId: Identifier) {
    const normalizedUserId = normalizeId(userId);
    const unreadNotifications = await db.findMany('notifications', {
      userId: normalizedUserId,
      isRead: false,
    });

    await Promise.all(unreadNotifications.map((n) => db.update('notifications', n.id, { isRead: true })));

    return { message: 'All notifications marked as read', count: unreadNotifications.length };
  }

  async deleteForUser(notificationId: Identifier, userId: Identifier) {
    const notification = await db.findById('notifications', notificationId);
    const normalizedUserId = normalizeId(userId);

    if (!notification || normalizeId(notification.userId) !== normalizedUserId) {
      throw ApiError.notFound('Notification not found');
    }

    return await super.delete(notificationId);
  }

  async deleteAll(userId: Identifier) {
    const normalizedUserId = normalizeId(userId);
    const userNotifications = await db.findMany('notifications', { userId: normalizedUserId });

    await Promise.all(userNotifications.map((n) => db.delete('notifications', n.id)));

    return { message: 'All notifications deleted', count: userNotifications.length };
  }
}

export default new NotificationService();
