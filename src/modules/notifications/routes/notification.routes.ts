import express from 'express';
import notificationController from '@modules/notifications/controllers/notification.controller';
import { requireAuth } from '@middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth); // All routes need auth

router.get('/settings', notificationController.getSettings);
router.put('/settings', notificationController.updateSettings);

router.get('/', notificationController.getNotifications);
router.patch('/:id/read', notificationController.markAsRead);
router.patch('/read-all', notificationController.markAllAsRead);
router.delete('/:id', notificationController.deleteNotification);
router.delete('/', notificationController.clearAll);

export default router;
