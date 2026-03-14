import express from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import uploadRoutes from './upload.routes';
import fileRoutes from './file.routes';
import notificationRoutes from './notification.routes';
import dutyRoutes from './duty.routes';
import rewardPenaltyRoutes from './reward-penalty.routes';
import reportRoutes from './report.routes';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/upload', uploadRoutes);
router.use('/files', fileRoutes);
router.use('/notifications', notificationRoutes);
router.use('/duty', dutyRoutes);
router.use('/reward-penalties', rewardPenaltyRoutes);
router.use('/reports', reportRoutes);

export default router;
