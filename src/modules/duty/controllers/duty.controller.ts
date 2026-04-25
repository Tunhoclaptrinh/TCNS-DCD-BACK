import BaseController from '@shared/common/base-controller';
import type { AnyRecord, Identifier } from '@app-types/common';

import dutySlotsService from '@modules/duty/services/duty-slots.service';
import dutySwapRequestsService from '@modules/duty/services/duty-swap-requests.service';
import dutyLeaveRequestsService from '@modules/duty/services/duty-leave-requests.service';
import dutyTemplatesService from '@modules/duty/services/duty-templates.service';
import dutyTemplateAssignmentsService from '@modules/duty/services/duty-template-assignments.service';
import dutySettingService from '@modules/duty/services/duty-settings.service';

class DutyController extends BaseController {
  getCurrentUser(req) {
    return req.user as AnyRecord & { id: Identifier };
  }

  getWeeklySchedule = this.handle(async (req, res) => {
    const data = await dutySlotsService.getWeeklySchedule({
      ...req.parsedQuery,
      weekStart: req.query.weekStart || req.query.week_start,
    });
    this.ok(res, data);
  });

  createSlot = this.handle(async (req, res) => {
    const data = await dutySlotsService.createSlot(req.body, req.user.id);
    this.created(res, data);
  });

  createActualShift = this.handle(async (req, res) => {
    const data = await dutySlotsService.createActualShift(req.body, req.user.id);
    this.created(res, data);
  });

  createActualKip = this.handle(async (req, res) => {
    const data = await dutySlotsService.createActualKip(req.body, req.user.id);
    this.created(res, data);
  });

  updateSlot = this.handle(async (req, res) => {
    const data = await dutySlotsService.updateSlot(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteSlot = this.handle(async (req, res) => {
    const data = await dutySlotsService.deleteSlot(req.params.id, req.user.id);
    this.ok(res, data);
  });

  deleteActualKip = this.handle(async (req, res) => {
    const data = await dutySlotsService.deleteActualKip(parseInt(req.params.id, 10));
    this.ok(res, data);
  });

  registerToSlot = this.handle(async (req, res) => {
    const data = await dutySlotsService.registerToSlot(req.params.id, req.user);
    this.ok(res, data);
  });

  cancelRegistration = this.handle(async (req, res) => {
    const data = await dutySlotsService.cancelRegistration(req.params.id, req.user);
    this.ok(res, data);
  });

  requestSwap = this.handle(async (req, res) => {
    const data = await dutySwapRequestsService.requestSwap(req.body, this.getCurrentUser(req));
    this.created(res, data);
  });

  getSwapRequests = this.handle(async (req, res) => {
    const data = await dutySwapRequestsService.getSwapRequests(req.user, req.parsedQuery);
    this.ok(res, data);
  });

  decideSwap = this.handle(async (req, res) => {
    const data = await dutySwapRequestsService.decideSwap(req.params.id, req.body, this.getCurrentUser(req));
    this.ok(res, data);
  });

  createSwapManual = this.handle(async (req, res) => {
    const data = await dutySwapRequestsService.createSwapManual(req.body, req.user.id);
    this.created(res, data);
  });

  updateSwapRequest = this.handle(async (req, res) => {
    const data = await dutySwapRequestsService.updateSwapRequest(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteSwapRequest = this.handle(async (req, res) => {
    const data = await dutySwapRequestsService.deleteSwapRequest(req.params.id);
    this.ok(res, data);
  });

  // Leave Requests
  requestLeave = this.handle(async (req, res) => {
    const { slotId, reason } = req.body;
    const data = await dutyLeaveRequestsService.requestLeave(slotId, req.user.id, reason);
    this.created(res, data);
  });

  getLeaveRequests = this.handle(async (req, res) => {
    const data = await dutyLeaveRequestsService.getLeaveRequests(req.parsedQuery);
    this.ok(res, data);
  });

  resolveLeaveRequest = this.handle(async (req, res) => {
    const { status, rejectionReason } = req.body;
    const data = await dutyLeaveRequestsService.resolveLeaveRequest(
      req.params.id,
      status,
      req.user.id,
      rejectionReason,
    );
    this.ok(res, data);
  });

  createLeaveManual = this.handle(async (req, res) => {
    const data = await dutyLeaveRequestsService.createLeaveManual(req.body, req.user.id);
    this.created(res, data);
  });

  updateLeaveRequest = this.handle(async (req, res) => {
    const data = await dutyLeaveRequestsService.updateLeaveRequest(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteLeaveRequest = this.handle(async (req, res) => {
    const data = await dutyLeaveRequestsService.deleteLeaveRequest(req.params.id);
    this.ok(res, data);
  });

  // Templates
  getTemplateGroups = this.handle(async (_req, res) => {
    const data = await dutyTemplatesService.getTemplates();
    this.ok(res, data);
  });

  createTemplateGroup = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.createTemplate(req.body);
    this.created(res, data);
  });

  updateTemplateGroup = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.updateTemplate(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteTemplateGroup = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.deleteTemplate(req.params.id);
    this.ok(res, data);
  });

  getShiftTemplates = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.getShiftTemplates(req.query.templateId as string);
    this.ok(res, data);
  });

  createShiftTemplate = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.createShiftTemplate(req.body);
    this.created(res, data);
  });

  updateShiftTemplate = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.updateShiftTemplate(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteShiftTemplate = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.deleteShiftTemplate(req.params.id);
    this.ok(res, data);
  });

  createKipTemplate = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.createKipTemplate(req.body);
    this.created(res, data);
  });

  updateKipTemplate = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.updateKipTemplate(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteKipTemplate = this.handle(async (req, res) => {
    const data = await dutyTemplatesService.deleteKipTemplate(req.params.id);
    this.ok(res, data);
  });

  generateWeekSlots = this.handle(async (req, res) => {
    const { weekStart } = req.body;
    const data = await dutySlotsService.generateWeekSlots(weekStart, req.user.id);
    this.ok(res, data);
  });

  generateDaySlots = this.handle(async (req, res) => {
    const { date } = req.body;
    const data = await dutySlotsService.generateDaySlots(date, req.user.id);
    this.ok(res, data);
  });

  // Assignments
  getTemplateAssignments = this.handle(async (_req, res) => {
    const data = await dutyTemplateAssignmentsService.getTemplateAssignments();
    this.ok(res, data);
  });

  createTemplateAssignment = this.handle(async (req, res) => {
    const data = await dutyTemplateAssignmentsService.createTemplateAssignment(req.body, req.user.id);
    this.created(res, data);
  });

  updateTemplateAssignment = this.handle(async (req, res) => {
    const data = await dutyTemplateAssignmentsService.updateTemplateAssignment(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteTemplateAssignment = this.handle(async (req, res) => {
    const data = await dutyTemplateAssignmentsService.deleteTemplateAssignment(req.params.id);
    this.ok(res, data);
  });

  // Advanced Operations
  generateRangeSlots = this.handle(async (req, res) => {
    const { startDate, endDate, templateId, mode, jobId } = req.body;
    const data = await dutySlotsService.generateRangeSlots(startDate, endDate, req.user.id, templateId, mode, jobId);
    this.ok(res, data);
  });

  deleteRangeSlots = this.handle(async (req, res) => {
    const { startDate, endDate } = req.body;
    const data = await dutySlotsService.deleteRangeSlots(startDate, endDate, req.user.id);
    this.ok(res, data);
  });

  copyWeekSchedule = this.handle(async (req, res) => {
    const { sourceWeek, targetWeek } = req.body;
    const data = await dutySlotsService.copyWeekSchedule(sourceWeek, targetWeek, req.user.id);
    this.ok(res, data);
  });

  deleteWeeklySlots = this.handle(async (req, res) => {
    const { weekStart } = req.body;
    const data = await dutySlotsService.deleteWeeklySlots(weekStart);
    this.ok(res, data);
  });

  deleteShiftSlots = this.handle(async (req, res) => {
    const { date, shiftId } = req.body;
    const data = await dutySlotsService.deleteShiftSlots(date, shiftId, req.user.id);
    this.ok(res, data);
  });

  addShiftToDay = this.handle(async (req, res) => {
    const { date, shiftId, overrides, mode } = req.body;
    const data = await dutySlotsService.addShiftToDay(date, shiftId, req.user.id, overrides, mode);
    this.ok(res, data);
  });

  removeShiftFromDay = this.handle(async (req, res) => {
    const { date, shiftId } = req.body;
    const data = await dutySlotsService.removeShiftFromDay(date, shiftId);
    this.ok(res, data);
  });

  markAttendance = this.handle(async (req, res) => {
    const { ids } = req.body;
    const data = await dutySlotsService.markAttendance(req.params.id, ids, req.user.id);
    this.ok(res, data);
  });

  // Settings
  getSettings = this.handle(async (_req, res) => {
    const data = await dutySettingService.getSettings();
    this.ok(res, data);
  });

  updateSettings = this.handle(async (req, res) => {
    const data = await dutySettingService.updateSettings(req.body);
    this.ok(res, data);
  });

  getStats = this.handle(async (_req, res) => {
    const data = await dutySlotsService.getStats();
    this.ok(res, data);
  });
}

export default new DutyController();
