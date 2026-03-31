import { Router } from 'express';
import dutyController from '@modules/duty/controllers/duty.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = Router();

router.use(requireAuth);

router.get('/week', requirePermission('duty:view'), dutyController.getWeeklySchedule);
router.get('/stats/summary', requirePermission('duty:view'), dutyController.getStats);

router.post('/slots', requirePermission('duty:manage'), dutyController.createSlot);
router.put('/slots/:id', requirePermission('duty:manage'), dutyController.updateSlot);

router.patch('/slots/:id/register', requirePermission('duty:register'), dutyController.registerToSlot);
router.patch('/slots/:id/cancel', requirePermission('duty:update'), dutyController.cancelRegistration);

router.post('/swaps', requirePermission('duty:update'), dutyController.requestSwap);
router.get('/swaps', requirePermission('duty:view'), dutyController.getSwapRequests);
router.patch('/swaps/:id/decision', requirePermission('duty:approve_swap'), dutyController.decideSwap);

export default router;
