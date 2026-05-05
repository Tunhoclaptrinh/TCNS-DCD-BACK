import dutyService from '@modules/duty/services/duty.service';
import BaseController from '@shared/common/base-controller';
import type { AnyRecord, Identifier } from '@app-types/common';
import dayjs from 'dayjs';

class DutyController extends BaseController {
  getCurrentUser(req) {
    return req.user as AnyRecord & { id: Identifier };
  }

  getWeeklySchedule = this.handle(async (req, res) => {
    const data = await dutyService.getWeeklySchedule({
      ...req.parsedQuery,
      weekStart: req.query.weekStart || req.query.week_start,
      userId: req.user?.id,
    });
    this.ok(res, data);
  });

  getSlot = this.handle(async (req, res) => {
    const data = await dutyService.findById(req.params.id);
    this.ok(res, data);
  });

  createSlot = this.handle(async (req, res) => {
    const data = await dutyService.createSlot(req.body, req.user.id);
    this.created(res, data);
  });

  createActualShift = this.handle(async (req, res) => {
    const data = await dutyService.createActualShift(req.body, req.user.id);
    this.created(res, data);
  });

  createActualKip = this.handle(async (req, res) => {
    const data = await dutyService.createActualKip(req.body, req.user.id);
    this.created(res, data);
  });

  updateActualShift = this.handle(async (req, res) => {
    const data = await dutyService.updateActualShift(parseInt(req.params.id, 10), req.body);
    this.ok(res, data);
  });

  updateActualKip = this.handle(async (req, res) => {
    const data = await dutyService.updateActualKip(parseInt(req.params.id, 10), req.body);
    this.ok(res, data);
  });

  updateSlot = this.handle(async (req, res) => {
    const data = await dutyService.updateSlot(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteSlot = this.handle(async (req, res) => {
    const data = await dutyService.deleteSlot(req.params.id, req.user.id);
    this.ok(res, data);
  });

  deleteActualKip = this.handle(async (req, res) => {
    const data = await dutyService.deleteActualKip(parseInt(req.params.id, 10));
    this.ok(res, data);
  });

  registerToSlot = this.handle(async (req, res) => {
    const data = await dutyService.registerToSlot(req.params.id, req.user);
    this.ok(res, data);
  });

  cancelRegistration = this.handle(async (req, res) => {
    const data = await dutyService.cancelRegistration(req.params.id, req.user);
    this.ok(res, data);
  });

  requestSwap = this.handle(async (req, res) => {
    const data = await dutyService.requestSwap(req.body, this.getCurrentUser(req));
    this.created(res, data);
  });

  getSwapRequests = this.handle(async (req, res) => {
    const data = await dutyService.getSwapRequests(req.user, req.parsedQuery);
    this.ok(res, data);
  });

  decideSwap = this.handle(async (req, res) => {
    const data = await dutyService.decideSwap(req.params.id, req.body, this.getCurrentUser(req));
    this.ok(res, data);
  });

  createSwapManual = this.handle(async (req, res) => {
    const data = await dutyService.createSwapManual(req.body, req.user.id);
    this.created(res, data);
  });

  updateSwapRequest = this.handle(async (req, res) => {
    const data = await dutyService.updateSwapRequest(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteSwapRequest = this.handle(async (req, res) => {
    const data = await dutyService.deleteSwapRequest(req.params.id);
    this.ok(res, data);
  });

  // Leave Requests
  requestLeave = this.handle(async (req, res) => {
    const { slotId, reason } = req.body;
    const data = await dutyService.requestLeave(slotId, req.user.id, reason);
    this.created(res, data);
  });

  getLeaveRequests = this.handle(async (req, res) => {
    const data = await dutyService.getLeaveRequests(req.parsedQuery);
    this.ok(res, data);
  });

  resolveLeaveRequest = this.handle(async (req, res) => {
    const { status, rejectionReason } = req.body;
    const data = await dutyService.resolveLeaveRequest(req.params.id, status, req.user.id, rejectionReason);
    this.ok(res, data);
  });

  createLeaveManual = this.handle(async (req, res) => {
    const data = await dutyService.createLeaveManual(req.body, req.user.id);
    this.created(res, data);
  });

  updateLeaveRequest = this.handle(async (req, res) => {
    const data = await dutyService.updateLeaveRequest(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteLeaveRequest = this.handle(async (req, res) => {
    const data = await dutyService.deleteLeaveRequest(req.params.id);
    this.ok(res, data);
  });

  // Templates
  getTemplateGroups = this.handle(async (_req, res) => {
    const data = await dutyService.getTemplates();
    this.ok(res, data);
  });

  createTemplateGroup = this.handle(async (req, res) => {
    const data = await dutyService.createTemplate(req.body);
    this.created(res, data);
  });

  updateTemplateGroup = this.handle(async (req, res) => {
    const data = await dutyService.updateTemplate(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteTemplateGroup = this.handle(async (req, res) => {
    const data = await dutyService.deleteTemplate(req.params.id);
    this.ok(res, data);
  });

  getShiftTemplates = this.handle(async (req, res) => {
    const data = await dutyService.getShiftTemplates(req.query.templateId as string);
    this.ok(res, data);
  });

  createShiftTemplate = this.handle(async (req, res) => {
    const data = await dutyService.createShiftTemplate(req.body);
    this.created(res, data);
  });

  updateShiftTemplate = this.handle(async (req, res) => {
    const data = await dutyService.updateShiftTemplate(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteShiftTemplate = this.handle(async (req, res) => {
    const data = await dutyService.deleteShiftTemplate(req.params.id);
    this.ok(res, data);
  });

  createKipTemplate = this.handle(async (req, res) => {
    const data = await dutyService.createKipTemplate(req.body);
    this.created(res, data);
  });

  updateKipTemplate = this.handle(async (req, res) => {
    const data = await dutyService.updateKipTemplate(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteKipTemplate = this.handle(async (req, res) => {
    const data = await dutyService.deleteKipTemplate(req.params.id);
    this.ok(res, data);
  });

  generateWeekSlots = this.handle(async (req, res) => {
    const { weekStart } = req.body;
    const data = await dutyService.generateWeekSlots(weekStart, req.user.id);
    this.ok(res, data);
  });

  generateDaySlots = this.handle(async (req, res) => {
    const { date } = req.body;
    const data = await dutyService.generateDaySlots(date, req.user.id);
    this.ok(res, data);
  });

  getSlotLogs = this.handle(async (req, res) => {
    const data = await dutyService.getSlotLogs(req.params.id);
    this.ok(res, data);
  });

  getSlotRequests = this.handle(async (req, res) => {
    const data = await dutyService.getSlotRequests(req.params.id);
    this.ok(res, data);
  });

  // Assignments
  getTemplateAssignments = this.handle(async (_req, res) => {
    const data = await dutyService.getTemplateAssignments();
    this.ok(res, data);
  });

  createTemplateAssignment = this.handle(async (req, res) => {
    const data = await dutyService.createTemplateAssignment(req.body, req.user.id);
    this.created(res, data);
  });

  updateTemplateAssignment = this.handle(async (req, res) => {
    const data = await dutyService.updateTemplateAssignment(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteTemplateAssignment = this.handle(async (req, res) => {
    const data = await dutyService.deleteTemplateAssignment(req.params.id);
    this.ok(res, data);
  });

  // Advanced Operations
  generateRangeSlots = this.handle(async (req, res) => {
    const { startDate, endDate, templateId, mode, jobId } = req.body;
    const data = await dutyService.generateRangeSlots(startDate, endDate, req.user.id, templateId, mode, jobId);
    this.ok(res, data);
  });

  deleteRangeSlots = this.handle(async (req, res) => {
    const { startDate, endDate } = req.body;
    const data = await dutyService.deleteRangeSlots(startDate, endDate, req.user.id);
    this.ok(res, data);
  });

  copyWeekSchedule = this.handle(async (req, res) => {
    const { sourceWeek, targetWeek } = req.body;
    const data = await dutyService.copyWeekSchedule(sourceWeek, targetWeek, req.user.id);
    this.ok(res, data);
  });

  deleteWeeklySlots = this.handle(async (req, res) => {
    const { weekStart } = req.body;
    const data = await dutyService.deleteWeeklySlots(weekStart);
    this.ok(res, data);
  });

  deleteShiftSlots = this.handle(async (req, res) => {
    const { date, shiftId } = req.body;
    const data = await dutyService.deleteShiftSlots(date, shiftId, req.user.id);
    this.ok(res, data);
  });

  addShiftToDay = this.handle(async (req, res) => {
    const { date, shiftId, overrides, mode } = req.body;
    const data = await dutyService.addShiftToDay(date, shiftId, req.user.id, overrides, mode);
    this.ok(res, data);
  });

  removeShiftFromDay = this.handle(async (req, res) => {
    const { date, shiftId } = req.body;
    const data = await dutyService.removeShiftFromDay(date, shiftId);
    this.ok(res, data);
  });

  selfCheckIn = this.handle(async (req, res) => {
    const data = await dutyService.selfCheckIn(req.params.id, req.user, req.ip || '');
    this.ok(res, data);
  });

  markAttendance = this.handle(async (req, res) => {
    const { ids, userId, isIncremental } = req.body;
    if (userId) {
      const data = await dutyService.leaderMarkAttendance(req.params.id, userId, req.user);
      return this.ok(res, data);
    }
    const data = await dutyService.markAttendance(req.params.id, ids, req.user, isIncremental);
    this.ok(res, data);
  });

  reportViolation = this.handle(async (req, res) => {
    const data = await dutyService.reportViolation({ ...req.body, slotId: req.params.id }, req.user);
    this.ok(res, data);
  });

  // Settings
  getSettings = this.handle(async (_req, res) => {
    const data = await dutyService.getSettings();
    this.ok(res, data);
  });

  updateSettings = this.handle(async (req, res) => {
    const data = await dutyService.updateSettings(req.body);
    this.ok(res, data);
  });

  getStats = this.handle(async (_req, res) => {
    const data = await dutyService.getStats();
    this.ok(res, data);
  });

  getComprehensiveStats = this.handle(async (req, res) => {
    const data = await dutyService.getComprehensiveStats(req.parsedQuery);
    this.ok(res, data);
  });

  exportStats = this.handle(async (req, res) => {
    const data = await dutyService.exportStats(req.parsedQuery);
    this.ok(res, data);
  });

  notifyAbsentees = this.handle(async (req, res) => {
    const { stats, message } = req.body;
    const data = await dutyService.notifyAbsentees(stats, req.user.id, message);
    this.ok(res, data);
  });

  getUserRemarks = this.handle(async (req, res) => {
    const data = await dutyService.getUserRemarks(req.params.id);
    this.ok(res, data);
  });

  exportWeeklyExcel = this.handle(async (req, res) => {
    const { weekStart, mode, startDate, endDate, includeDays, date } = req.query;

    // Parse includeDays if it's a string (from query params)
    let parsedIncludes = [];
    if (typeof includeDays === 'string') parsedIncludes = includeDays.split(',').map(Number);
    else if (Array.isArray(includeDays)) parsedIncludes = includeDays.map(Number);

    const buffer = await dutyService.exportRangeExcel({
      weekStart,
      mode,
      startDate,
      endDate,
      includeDays: parsedIncludes,
      date,
    });

    const label = startDate ? dayjs(startDate as string).format('DDMM') : dayjs(weekStart as string).format('WW');
    const fileName = `Lich_Truc_${label}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    res.send(buffer);
  });

  // Snapshots
  getSnapshots = this.handle(async (_req, res) => {
    const { dutySnapshotsService } = require('../services/duty-snapshots.service');
    const data = await dutySnapshotsService.getSnapshots();
    this.ok(res, data);
  });

  createSnapshot = this.handle(async (req, res) => {
    const { dutySnapshotsService } = require('../services/duty-snapshots.service');
    const data = await dutySnapshotsService.createSnapshot(req.body, req.user.id);
    this.created(res, data);
  });

  deleteSnapshot = this.handle(async (req, res) => {
    const { dutySnapshotsService } = require('../services/duty-snapshots.service');
    await dutySnapshotsService.deleteSnapshot(req.params.id);
    this.ok(res, { success: true });
  });
}

export default new DutyController();
