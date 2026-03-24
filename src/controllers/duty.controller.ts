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
}

export default new DutyController();
