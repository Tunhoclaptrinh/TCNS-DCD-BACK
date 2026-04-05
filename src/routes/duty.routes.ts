import { Router } from 'express';
import dutyController from '@controllers/duty/duty.controller';
import { protect } from '@middleware/auth.middleware';
import { checkPermission } from '@middleware/rbac.middleware';

const router = Router();

router.use(protect);

router.get('/week', checkPermission('duty:view'), dutyController.getWeeklySchedule);
router.get('/stats/summary', checkPermission('duty:view'), dutyController.getStats);
router.get('/settings', checkPermission('duty:view'), dutyController.getSettings);
router.put('/settings', checkPermission('duty:manage'), dutyController.updateSettings);

router.post('/slots', checkPermission('duty:manage'), dutyController.createSlot);
router.put('/slots/:id', checkPermission('duty:manage'), dutyController.updateSlot);
router.delete('/slots/:id', checkPermission('duty:manage'), dutyController.deleteSlot);
router.delete('/slots-shift', checkPermission('duty:manage'), dutyController.deleteShiftSlots);

router.patch('/slots/:id/register', checkPermission('duty:register'), dutyController.registerToSlot);
router.patch('/slots/:id/cancel', checkPermission('duty:update'), dutyController.cancelRegistration);

router.post('/swaps', checkPermission('duty:register'), dutyController.requestSwap);
router.get('/swaps', checkPermission('duty:view'), dutyController.getSwapRequests);
router.post('/swaps/manual', checkPermission('duty:manage'), dutyController.createSwapManual);
router.put('/swaps/:id', checkPermission('duty:manage'), dutyController.updateSwapRequest);
router.delete('/swaps/:id', checkPermission('duty:manage'), dutyController.deleteSwapRequest);
router.patch('/swaps/:id/decision', checkPermission('duty:approve_swap'), dutyController.decideSwap);

// Template Groups
router.get('/templates/groups', checkPermission('duty:view'), dutyController.getTemplates);
router.post('/templates/groups', checkPermission('duty:manage'), dutyController.createTemplate);
router.put('/templates/groups/:id', checkPermission('duty:manage'), dutyController.updateTemplate);
router.delete('/templates/groups/:id', checkPermission('duty:manage'), dutyController.deleteTemplate);

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

// Template Assignments
router.get('/assignment', checkPermission('duty:view'), dutyController.getTemplateAssignments);
router.post('/assignment', checkPermission('duty:manage'), dutyController.createTemplateAssignment);
router.put('/assignment/:id', checkPermission('duty:manage'), dutyController.updateTemplateAssignment);
router.delete('/assignment/:id', checkPermission('duty:manage'), dutyController.deleteTemplateAssignment);
router.post('/template-shifts-day', checkPermission('duty:manage'), dutyController.addShiftToDay);
router.delete('/template-shifts-day', checkPermission('duty:manage'), dutyController.removeShiftFromDay);

// Attendance & Leave
router.post('/slots/:id/attendance', checkPermission('duty:manage'), dutyController.markAttendance);
router.post('/leave-request', checkPermission('duty:register'), dutyController.requestLeave);
router.get('/leave-requests', checkPermission('duty:view'), dutyController.getLeaveRequests);
router.post('/leave-requests/manual', checkPermission('duty:manage'), dutyController.createLeaveManual);
router.put('/leave-requests/:id', checkPermission('duty:manage'), dutyController.updateLeaveRequest);
router.delete('/leave-requests/:id', checkPermission('duty:manage'), dutyController.deleteLeaveRequest);
router.patch('/leave-requests/:id/resolve', checkPermission('duty:approve_leave'), dutyController.resolveLeaveRequest);

export default router;
