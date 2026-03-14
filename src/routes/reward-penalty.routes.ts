import express from 'express';
import rewardPenaltyController from '@controllers/reward-penalty/reward-penalty.controller';
import { protect } from '@middleware/auth.middleware';
import { checkPermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(protect);

router.get('/', checkPermission('reward_penalty:view'), rewardPenaltyController.getHistory);
router.get('/stats/financial', checkPermission('reward_penalty:view'), rewardPenaltyController.getFinancialStats);
router.post('/', checkPermission('reward_penalty:manage'), rewardPenaltyController.createEntry);

export default router;
