import type { NextFunction, Request, Response } from 'express';

import BaseController from '@shared/common/base-controller';
import notificationService from '@modules/notifications/services/notification.service';

class NotificationController extends BaseController {
  constructor() {
    super(notificationService);
  }

  getNotifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getNotifications(req.user.id, req.parsedQuery);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.markAsRead(req.params.id, req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.markAllAsRead(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.deleteForUser(req.params.id, req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  clearAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.deleteAll(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.getSettings(req.user.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.updateSettings(req.user.id, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new NotificationController();
