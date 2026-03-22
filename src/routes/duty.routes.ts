import { Router } from 'express';
import dutyController from '@controllers/duty/duty.controller';
import { protect } from '@middleware/auth.middleware';
import { checkPermission } from '@middleware/rbac.middleware';

const router = Router();

router.use(protect);

router.get('/week', checkPermission('duty:view'), dutyController.getWeeklySchedule);
router.get('/stats/summary', checkPermission('duty:view'), dutyController.getStats);

router.post('/slots', checkPermission('duty:manage'), dutyController.createSlot);
router.put('/slots/:id', checkPermission('duty:manage'), dutyController.updateSlot);
router.delete('/slots/:id', checkPermission('duty:manage'), dutyController.deleteSlot);
router.delete('/slots-shift', checkPermission('duty:manage'), dutyController.deleteShiftSlots);

router.patch('/slots/:id/register', checkPermission('duty:register'), dutyController.registerToSlot);
router.patch('/slots/:id/cancel', checkPermission('duty:update'), dutyController.cancelRegistration);

router.post('/swaps', checkPermission('duty:update'), dutyController.requestSwap);
router.get('/swaps', checkPermission('duty:view'), dutyController.getSwapRequests);
router.patch('/swaps/:id/decision', checkPermission('duty:approve_swap'), dutyController.decideSwap);

// Template & Generation
router.get('/templates', checkPermission('duty:view'), dutyController.getShiftTemplates);
router.post('/templates/shifts', checkPermission('duty:manage'), dutyController.createShiftTemplate);
router.put('/templates/shifts/:id', checkPermission('duty:manage'), dutyController.updateShiftTemplate);
router.delete('/templates/shifts/:id', checkPermission('duty:manage'), dutyController.deleteShiftTemplate);
router.post('/templates/kips', checkPermission('duty:manage'), dutyController.createKipTemplate);
router.put('/templates/kips/:id', checkPermission('duty:manage'), dutyController.updateKipTemplate);
router.delete('/templates/kips/:id', checkPermission('duty:manage'), dutyController.deleteKipTemplate);
router.post('/templates/copy', checkPermission('duty:manage'), dutyController.copyWeekSchedule);
router.post('/generate-range', checkPermission('duty:manage'), dutyController.generateRangeSlots);
router.delete('/slots-range', checkPermission('duty:manage'), dutyController.deleteRangeSlots);
router.delete('/slots-week', checkPermission('duty:manage'), dutyController.deleteWeeklySlots);

// Attendance & Leave
router.post('/slots/:id/attendance', checkPermission('duty:manage'), dutyController.markAttendance);
router.post('/leave-request', checkPermission('duty:register'), dutyController.requestLeave);
router.get('/leave-requests', checkPermission('duty:view'), dutyController.getLeaveRequests);
router.patch('/leave-requests/:id/resolve', checkPermission('duty:approve_leave'), dutyController.resolveLeaveRequest);

export default router;
