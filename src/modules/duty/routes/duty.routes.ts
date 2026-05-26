import { Router } from 'express';
import dutyController from '@modules/duty/controllers/duty.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = Router();

router.use(requireAuth);

router.get('/week', requirePermission('duty:view'), dutyController.getWeeklySchedule);
router.get('/week/export', requirePermission('duty:view'), dutyController.exportWeeklyExcel);
router.get('/stats/summary', requirePermission('duty:view'), dutyController.getStats);
router.get('/stats/comprehensive', requirePermission('duty:manage'), dutyController.getComprehensiveStats);
router.get('/stats/export', requirePermission('duty:manage'), dutyController.exportStats);
router.post('/stats/notify-absentees', requirePermission('duty:manage'), dutyController.notifyAbsentees);
router.get('/remarks/user/:id', requirePermission('duty:manage'), dutyController.getUserRemarks);

// Snapshots
router.get('/snapshots', requirePermission('duty:manage'), dutyController.getSnapshots);
router.post('/snapshots', requirePermission('duty:manage'), dutyController.createSnapshot);
router.delete('/snapshots/:id', requirePermission('duty:manage'), dutyController.deleteSnapshot);

// Slots
router.post('/slots', requirePermission('duty:manage'), dutyController.createSlot);
router.post('/shifts', requirePermission('duty:manage'), dutyController.createActualShift);
router.put('/shifts/:id', requirePermission('duty:manage'), dutyController.updateActualShift);
router.post('/kips', requirePermission('duty:manage'), dutyController.createActualKip);
router.put('/kips/:id', requirePermission('duty:manage'), dutyController.updateActualKip);
router.delete('/kips/:id', requirePermission('duty:manage'), dutyController.deleteActualKip);

router.get('/slots/:id', requirePermission('duty:view'), dutyController.getSlot);
router.put('/slots/:id', requirePermission('duty:manage'), dutyController.updateSlot);
router.delete('/slots/:id', requirePermission('duty:manage'), dutyController.deleteSlot);
router.patch('/slots/:id/register', requirePermission('duty:register:self'), dutyController.registerToSlot);
router.patch('/slots/:id/cancel', requirePermission('duty:update'), dutyController.cancelRegistration);
router.post('/slots/:id/attendance', dutyController.markAttendance);
router.post('/slots/:id/check-in', dutyController.selfCheckIn);
router.post('/slots/:id/violation', requirePermission('duty:violation:report'), dutyController.reportViolation);
router.get('/slots/:id/logs', requirePermission('duty:view'), dutyController.getSlotLogs);
router.get('/slots/:id/requests', requirePermission('duty:view'), dutyController.getSlotRequests);

// Leave Requests
router.post('/leave-request', requirePermission('duty:register:self'), dutyController.requestLeave);
router.get('/leave-requests', requirePermission('duty:view'), dutyController.getLeaveRequests);
router.post('/leave-requests/manual', requirePermission('duty:manage'), dutyController.createLeaveManual);
router.patch(
  '/leave-requests/:id/resolve',
  requirePermission('duty:approve_leave'),
  dutyController.resolveLeaveRequest,
);
router.put('/leave-requests/:id', requirePermission('duty:manage'), dutyController.updateLeaveRequest);
router.delete('/leave-requests/:id', requirePermission('duty:manage'), dutyController.deleteLeaveRequest);

// Swaps
router.post('/swaps', requirePermission('duty:register:self'), dutyController.requestSwap);
router.get('/swaps', requirePermission('duty:view'), dutyController.getSwapRequests);
router.patch('/swaps/:id/decision', requirePermission('duty:approve_swap'), dutyController.decideSwap);
router.post('/swaps/manual', requirePermission('duty:manage'), dutyController.createSwapManual);
router.put('/swaps/:id', requirePermission('duty:manage'), dutyController.updateSwapRequest);
router.delete('/swaps/:id', requirePermission('duty:manage'), dutyController.deleteSwapRequest);

// Templates & Generation
router.get('/templates/groups', requirePermission('duty:view'), dutyController.getTemplateGroups);
router.post('/templates/groups', requirePermission('duty:manage'), dutyController.createTemplateGroup);
router.put('/templates/groups/:id', requirePermission('duty:manage'), dutyController.updateTemplateGroup);
router.delete('/templates/groups/:id', requirePermission('duty:manage'), dutyController.deleteTemplateGroup);

router.get('/templates', requirePermission('duty:manage'), dutyController.getShiftTemplates);
router.post('/templates/shifts', requirePermission('duty:manage'), dutyController.createShiftTemplate);
router.put('/templates/shifts/:id', requirePermission('duty:manage'), dutyController.updateShiftTemplate);
router.delete('/templates/shifts/:id', requirePermission('duty:manage'), dutyController.deleteShiftTemplate);

router.post('/templates/kips', requirePermission('duty:manage'), dutyController.createKipTemplate);
router.put('/templates/kips/:id', requirePermission('duty:manage'), dutyController.updateKipTemplate);
router.delete('/templates/kips/:id', requirePermission('duty:manage'), dutyController.deleteKipTemplate);

router.post('/generate-range', requirePermission('duty:manage'), dutyController.generateRangeSlots);
router.delete('/slots-range', requirePermission('duty:manage'), dutyController.deleteRangeSlots);
router.post('/templates/copy', requirePermission('duty:manage'), dutyController.copyWeekSchedule);
router.delete('/slots-week', requirePermission('duty:manage'), dutyController.deleteWeeklySlots);
router.delete('/slots-shift', requirePermission('duty:manage'), dutyController.deleteShiftSlots);
router.post('/template-shifts-day', requirePermission('duty:manage'), dutyController.addShiftToDay);
router.delete('/template-shifts-day', requirePermission('duty:manage'), dutyController.removeShiftFromDay);

// Assignments
router.get('/assignment', requirePermission('duty:manage'), dutyController.getTemplateAssignments);
router.post('/assignment', requirePermission('duty:manage'), dutyController.createTemplateAssignment);
router.put('/assignment/:id', requirePermission('duty:manage'), dutyController.updateTemplateAssignment);
router.delete('/assignment/:id', requirePermission('duty:manage'), dutyController.deleteTemplateAssignment);

// Settings
router.get('/settings', requirePermission('duty:view'), dutyController.getSettings);
router.put('/settings', requirePermission('duty:manage'), dutyController.updateSettings);

// Period Config
router.get('/period-config', requirePermission('duty:view'), dutyController.getPeriodConfig);
router.put('/period-config', requirePermission('duty:manage'), dutyController.updatePeriodConfig);

// Days (lock/unlock)
router.patch('/days', requirePermission('duty:manage'), dutyController.setDayStatus);

export default router;
