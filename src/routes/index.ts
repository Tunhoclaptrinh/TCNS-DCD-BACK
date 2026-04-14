import express from 'express';
import authRoutes from '@modules/auth/routes/auth.routes';
import userRoutes from '@modules/users/routes/user.routes';
import uploadRoutes from '@modules/files/routes/upload.routes';
import fileRoutes from '@modules/files/routes/file.routes';
import notificationRoutes from '@modules/notifications/routes/notification.routes';
import dutyRoutes from '@modules/duty/routes/duty.routes';
import rewardPenaltyRoutes from '@modules/reward-penalties/routes/reward-penalty.routes';
import reportRoutes from '@modules/reports/routes/report.routes';
import generationRoutes from '@modules/generations/routes/generation.routes';
import roleRoutes from '@modules/roles/routes/role.routes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/upload', uploadRoutes);
router.use('/files', fileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/duty', dutyRoutes);
router.use('/reward-penalties', rewardPenaltyRoutes);
router.use('/reports', reportRoutes);
router.use('/generations', generationRoutes);
router.use('/roles', roleRoutes);

export default router;
