import BaseController from '@utils/base-controller';
import notificationService from '@services/common/notification.service';

class NotificationController extends BaseController {
  constructor() {
    super(notificationService);
  }

  getNotifications = async (req, res, next) => {
    try {
      const data = await this.service.getNotifications(req.user.id, req.parsedQuery);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req, res, next) => {
    try {
      const data = await this.service.markAsRead(req.params.id, req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req, res, next) => {
    try {
      const data = await this.service.markAllAsRead(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req, res, next) => {
    try {
      const data = await this.service.delete(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  clearAll = async (req, res, next) => {
    try {
      const data = await this.service.deleteAll(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new NotificationController();
