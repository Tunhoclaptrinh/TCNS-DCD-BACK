import BaseService from '@utils/base-service';
import db from '@config/database';
import ApiError from '@utils/api-error';

class NotificationService extends BaseService {
  constructor() {
    super('notifications');
  }

  async getNotifications(userId, options = {}) {
    const result = await db.findAllAdvanced('notifications', {
      ...options,
      filter: {
        ...options.filter,
        user_id: userId,
      },
      sort: 'created_at',
      order: 'desc',
    });

    const unreadCount = result.data.filter((n) => !n.is_read).length;

    return {
      data: result.data,
      unreadCount,
      pagination: result.pagination,
    };
  }

  async markAsRead(notificationId, userId) {
    const notification = await db.findById('notifications', notificationId);

    if (!notification || notification.user_id !== userId) {
      throw ApiError.notFound('Notification not found');
    }

    return await db.update('notifications', notificationId, { is_read: true });
  }

  async markAllAsRead(userId) {
    const unreadNotifications = await db.findMany('notifications', { user_id: userId, is_read: false });

    await Promise.all(unreadNotifications.map((n) => db.update('notifications', n.id, { is_read: true })));

    return { message: 'All notifications marked as read', count: unreadNotifications.length };
  }

  async deleteAll(userId) {
    const userNotifications = await db.findMany('notifications', { user_id: userId });

    await Promise.all(userNotifications.map((n) => db.delete('notifications', n.id)));

    return { message: 'All notifications deleted', count: userNotifications.length };
  }
}

export default new NotificationService();
