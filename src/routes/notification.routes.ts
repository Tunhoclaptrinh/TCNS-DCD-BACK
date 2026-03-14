import express from 'express';
import notificationController from '@controllers/notification/notification.controller';
import { protect } from '@middleware/auth.middleware';

const router = express.Router();

router.use(protect); // All routes need auth

router.get('/settings', notificationController.getSettings);
router.put('/settings', notificationController.updateSettings);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/', notificationController.clearAll);

export default router;
