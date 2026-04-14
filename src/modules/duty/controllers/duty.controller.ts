import dutyService from '@modules/duty/services/duty.service';
import BaseController from '@shared/common/base-controller';
import type { AnyRecord, Identifier } from '@app-types/common';

class DutyController extends BaseController {
  getCurrentUser(req) {
    return req.user as AnyRecord & { id: Identifier };
  }

  getWeeklySchedule = this.handle(async (req, res) => {
    const data = await dutyService.getWeeklySchedule({
      ...req.parsedQuery,
      weekStart: req.query.weekStart || req.query.week_start,
    });
    this.ok(res, data);
  });

  createSlot = this.handle(async (req, res) => {
    const data = await dutyService.createSlot(req.body, req.user.id);
    this.created(res, data);
  });

  updateSlot = this.handle(async (req, res) => {
    const data = await dutyService.updateSlot(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  registerToSlot = this.handle(async (req, res) => {
    const data = await dutyService.registerToSlot(req.params.id, this.getCurrentUser(req).id);
    this.ok(res, data);
  });

  cancelRegistration = this.handle(async (req, res) => {
    const data = await dutyService.cancelRegistration(req.params.id, this.getCurrentUser(req).id);
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

  getStats = this.handle(async (_req, res) => {
    const data = await dutyService.getStats();
    this.ok(res, data);
  });
}

export default new DutyController();
