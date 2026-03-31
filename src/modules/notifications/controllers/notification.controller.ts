import BaseController from '@shared/common/base-controller';
import notificationService from '@modules/notifications/services/notification.service';

class NotificationController extends BaseController {
  constructor() {
    super(notificationService);
  }

  getNotifications = this.handle(async (req, res) => {
    const data = await this.service.getNotifications(req.user.id, req.parsedQuery);
    this.ok(res, data);
  });

  markAsRead = this.handle(async (req, res) => {
    const data = await this.service.markAsRead(req.params.id, req.user.id);
    this.ok(res, data);
  });

  markAllAsRead = this.handle(async (req, res) => {
    const data = await this.service.markAllAsRead(req.user.id);
    this.ok(res, data);
  });

  deleteNotification = this.handle(async (req, res) => {
    const data = await this.service.deleteForUser(req.params.id, req.user.id);
    this.ok(res, data);
  });

  clearAll = this.handle(async (req, res) => {
    const data = await this.service.deleteAll(req.user.id);
    this.ok(res, data);
  });

  getSettings = this.handle(async (req, res) => {
    const data = await this.service.getSettings(req.user.id);
    this.ok(res, data);
  });

  updateSettings = this.handle(async (req, res) => {
    const data = await this.service.updateSettings(req.user.id, req.body);
    this.ok(res, data);
  });
}

export default new NotificationController();
