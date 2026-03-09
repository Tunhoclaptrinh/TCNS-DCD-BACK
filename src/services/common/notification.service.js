import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';

function normalizeId(id) {
  const parsed = Number(id);
  return Number.isNaN(parsed) ? id : parsed;
}

class NotificationService extends BaseService {
  constructor() {
    super('notifications');
  }

  async getNotifications(userId, options = {}) {
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

  async markAsRead(notificationId, userId) {
    const notification = await db.findById('notifications', notificationId);
    const normalizedUserId = normalizeId(userId);

    if (!notification || normalizeId(notification.user_id) !== normalizedUserId) {
      throw ApiError.notFound('Notification not found');
    }

    return await db.update('notifications', notificationId, { is_read: true });
  }

  async markAllAsRead(userId) {
    const normalizedUserId = normalizeId(userId);
    const unreadNotifications = await db.findMany('notifications', {
      user_id: normalizedUserId,
      is_read: false,
    });

    await Promise.all(unreadNotifications.map((n) => db.update('notifications', n.id, { is_read: true })));

    return { message: 'All notifications marked as read', count: unreadNotifications.length };
  }

  async deleteForUser(notificationId, userId) {
    const notification = await db.findById('notifications', notificationId);
    const normalizedUserId = normalizeId(userId);

    if (!notification || normalizeId(notification.user_id) !== normalizedUserId) {
      throw ApiError.notFound('Notification not found');
    }

    return await super.delete(notificationId);
  }

  async deleteAll(userId) {
    const normalizedUserId = normalizeId(userId);
    const userNotifications = await db.findMany('notifications', { user_id: normalizedUserId });

    await Promise.all(userNotifications.map((n) => db.delete('notifications', n.id)));

    return { message: 'All notifications deleted', count: userNotifications.length };
  }
}

export default new NotificationService();
