import express from 'express';
import bonusCampaignController from '@modules/bonus-campaigns/controllers/bonus-campaign.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('duty:view'), bonusCampaignController.getCampaigns);
router.get('/:id', requirePermission('duty:view'), bonusCampaignController.getCampaignById);

router.post('/', requirePermission('duty:manage'), bonusCampaignController.createCampaign);
router.put('/:id', requirePermission('duty:manage'), bonusCampaignController.updateCampaign);
router.delete('/:id', requirePermission('duty:manage'), bonusCampaignController.deleteCampaign);

router.patch('/:id/register', requirePermission('duty:view'), bonusCampaignController.registerCampaign);
router.post('/:id/review', requirePermission('duty:manage'), bonusCampaignController.reviewCampaign);
router.get('/:id/export', requirePermission('duty:manage'), bonusCampaignController.exportApprovedExcel);

export default router;
