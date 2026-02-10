const BaseController = require('../utils/BaseController');
const notificationService = require('../services/notification.service');

class NotificationController extends BaseController {
  constructor() {
    super(notificationService);
  }

  getNotifications = async (req, res, next) => {
    try {
      const result = await this.service.getNotifications(req.user.id, req.parsedQuery);

      res.json({
        success: true,
        data: result.data,
        unreadCount: result.unreadCount,
        pagination: result.pagination
      });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req, res, next) => {
    try {
      const result = await this.service.markAsRead(req.params.id, req.user.id);

      if (!result.success) {
        return res.status(result.statusCode || 400).json(result);
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  };


  markAllAsRead = async (req, res, next) => {
    try {
      const result = await this.service.markAllAsRead(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req, res, next) => {
    try {
      const result = await this.service.delete(req.params.id);
      if (!result) {
        return res.status(404).json({ success: false, message: "Notification not found" });
      }
      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      next(error);
    }
  };

  clearAll = async (req, res, next) => {
    try {
      const result = await this.service.deleteAll(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };
}

module.exports = new NotificationController();