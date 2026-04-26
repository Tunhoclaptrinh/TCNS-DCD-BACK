import rewardPenaltyService from '@modules/reward-penalties/services/reward-penalty.service';
import BaseController from '@shared/common/base-controller';

class RewardPenaltyController extends BaseController {
  createEntry = this.handle(async (req, res) => {
    const data = await rewardPenaltyService.createEntry(req.body, req.user.id);
    this.created(res, data);
  });

  updateEntry = this.handle(async (req, res) => {
    const data = await rewardPenaltyService.updateEntry(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  getHistory = this.handle(async (req, res) => {
    const data = await rewardPenaltyService.getHistory(req.user, req.parsedQuery);
    this.ok(res, data);
  });

  getFinancialStats = this.handle(async (req, res) => {
    const data = await rewardPenaltyService.getFinancialStats({
      ...(req.parsedQuery || {}),
      from: req.query.from,
      to: req.query.to,
      dateFrom: req.query.dateFrom || req.query.date_from,
      dateTo: req.query.dateTo || req.query.date_to,
    });
    this.ok(res, data);
  });
}

export default new RewardPenaltyController();
