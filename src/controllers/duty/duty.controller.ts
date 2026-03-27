import dutyService from '@services/duty/duty.service';

class DutyController {
  getWeeklySchedule = async (req, res, next) => {
    try {
      const data = await dutyService.getWeeklySchedule({
        ...req.parsedQuery,
        weekStart: req.query.weekStart || req.query.week_start,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  createSlot = async (req, res, next) => {
    try {
      const data = await dutyService.createSlot(req.body, req.user.id);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  updateSlot = async (req, res, next) => {
    try {
      const data = await dutyService.updateSlot(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteSlot = async (req, res, next) => {
    try {
      const data = await dutyService.delete(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  deleteShiftSlots = async (req, res, next) => {
    try {
      const { date, shiftId } = req.body;
      const data = await dutyService.deleteShiftSlots(date, shiftId);
      res.json({ success: true, count: data });
    } catch (error) {
      next(error);
    }
  };

  registerToSlot = async (req, res, next) => {
    try {
      const data = await dutyService.registerToSlot(req.params.id, req.user);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  cancelRegistration = async (req, res, next) => {
    try {
      const data = await dutyService.cancelRegistration(req.params.id, req.user);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  requestSwap = async (req, res, next) => {
    try {
      const data = await dutyService.requestSwap(req.body, req.user);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  getSwapRequests = async (req, res, next) => {
    try {
      const data = await dutyService.getSwapRequests(req.user, req.parsedQuery);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  decideSwap = async (req, res, next) => {
    try {
      const data = await dutyService.decideSwap(req.params.id, req.body, req.user);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req, res, next) => {
    try {
      const data = await dutyService.getStats();
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  // ==================== TEMPLATE GROUPS ====================

  getTemplates = async (req, res, next) => {
    try {
      const data = await dutyService.getTemplates();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.createTemplate(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.updateTemplate(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.deleteTemplate(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==================== TEMPLATE & GENERATION ====================

  getShiftTemplates = async (req, res, next) => {
    try {
      let { templateId } = req.query;
      // Convert "null" string or empty string from query to literal null
      if (templateId === 'null' || templateId === '') {
        templateId = null;
      }
      const data = await dutyService.getShiftTemplates(templateId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createShiftTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.createShiftTemplate(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateShiftTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.updateShiftTemplate(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteShiftTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.deleteShiftTemplate(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createKipTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.createKipTemplate(req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateKipTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.updateKipTemplate(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteKipTemplate = async (req, res, next) => {
    try {
      const data = await dutyService.deleteKipTemplate(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  generateWeekSlots = async (req, res, next) => {
    try {
      const { weekStart } = req.body;
      const data = await dutyService.generateWeekSlots(weekStart, req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  generateDaySlots = async (req, res, next) => {
    try {
      const { date } = req.body;
      const data = await dutyService.generateDaySlots(date, req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  copyWeekSchedule = async (req, res, next) => {
    try {
      const { sourceWeek, targetWeek } = req.body;
      const data = await dutyService.copyWeekSchedule(sourceWeek, targetWeek, req.user.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteWeeklySlots = async (req, res, next) => {
    try {
      const { weekStart } = req.body;
      const data = await dutyService.deleteWeeklySlots(weekStart);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  generateRangeSlots = async (req, res, next) => {
    try {
      const { startDate, endDate, templateId, mode } = req.body;
      const actorId = (req as any).user.id;

      const result = await dutyService.generateRangeSlots(startDate, endDate, actorId, templateId, mode);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deleteRangeSlots = async (req, res, next) => {
    try {
      const { startDate, endDate } = req.body;
      const data = await dutyService.deleteRangeSlots(startDate, endDate);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==================== ATTENDANCE & LEAVE ====================

  markAttendance = async (req, res, next) => {
    try {
      const { ids } = req.body;
      const data = await dutyService.markAttendance(req.params.id, ids);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  requestLeave = async (req, res, next) => {
    try {
      const { slotId, reason } = req.body;
      const data = await dutyService.requestLeave(slotId, req.user.id, reason);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getLeaveRequests = async (req, res, next) => {
    try {
      const data = await dutyService.getLeaveRequests(req.parsedQuery);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  resolveLeaveRequest = async (req, res, next) => {
    try {
      const { status, rejectionReason } = req.body;
      const data = await dutyService.resolveLeaveRequest(req.params.id, status, req.user.id, rejectionReason);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  // ==================== TEMPLATE ASSIGNMENTS ====================

  getTemplateAssignments = async (req, res, next) => {
    try {
      const data = await dutyService.getTemplateAssignments();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  createTemplateAssignment = async (req, res, next) => {
    try {
      const data = await dutyService.createTemplateAssignment(req.body, req.user.id);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  updateTemplateAssignment = async (req, res, next) => {
    try {
      const data = await dutyService.updateTemplateAssignment(req.params.id, req.body);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  deleteTemplateAssignment = async (req, res, next) => {
    try {
      const data = await dutyService.deleteTemplateAssignment(req.params.id);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  addShiftToDay = async (req, res, next) => {
    try {
      const { date, shiftId, overrides } = req.body;
      const data = await dutyService.addShiftToDay(date, shiftId, req.user.id, overrides);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  removeShiftFromDay = async (req, res, next) => {
    try {
      const { date, shiftId } = req.body;
      const data = await dutyService.removeShiftFromDay(date, shiftId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new DutyController();
