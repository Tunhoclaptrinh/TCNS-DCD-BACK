import express from 'express';
import dutyController from '@controllers/duty.controller';
import { protect } from '@middleware/auth.middleware';
import { checkPermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(protect);

router.get('/week', checkPermission('duty:view'), dutyController.getWeeklySchedule);

router.post('/slots', checkPermission('duty:manage'), dutyController.createSlot);
router.put('/slots/:id', checkPermission('duty:manage'), dutyController.updateSlot);

router.patch('/slots/:id/register', checkPermission('duty:register'), dutyController.registerToSlot);
router.patch('/slots/:id/cancel', checkPermission('duty:update'), dutyController.cancelRegistration);

router.post('/swaps', checkPermission('duty:update'), dutyController.requestSwap);
router.get('/swaps', checkPermission('duty:view'), dutyController.getSwapRequests);
router.patch('/swaps/:id/decision', checkPermission('duty:approve_swap'), dutyController.decideSwap);

export default router;
