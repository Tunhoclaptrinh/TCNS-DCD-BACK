import express from 'express';
import rewardPenaltyController from '@modules/reward-penalties/controllers/reward-penalty.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('reward_penalty:view'), rewardPenaltyController.getHistory);
router.get('/stats/financial', requirePermission('reward_penalty:view'), rewardPenaltyController.getFinancialStats);
router.post('/', requirePermission('reward_penalty:manage'), rewardPenaltyController.createEntry);

export default router;
