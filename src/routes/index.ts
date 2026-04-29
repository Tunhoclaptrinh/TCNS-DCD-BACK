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
import permissionRoutes from '@modules/permissions/routes/permission.routes';
import auditLogRoutes from '@modules/audit-logs/routes/audit-logs.routes';
import meetingRoutes from '@modules/meetings/routes/meeting.routes';
import bonusCampaignRoutes from '@modules/bonus-campaigns/routes/bonus-campaign.routes';
import bonusRegistrationRoutes from '@modules/bonus-registrations/routes/bonus-registration.routes';
import semesterRoutes from '@modules/semesters/routes/semesters.routes';

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
router.use('/permissions', permissionRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/meetings', meetingRoutes);
router.use('/bonus-campaigns', bonusCampaignRoutes);
router.use('/bonus-registrations', bonusRegistrationRoutes);
router.use('/semesters', semesterRoutes);

export default router;
