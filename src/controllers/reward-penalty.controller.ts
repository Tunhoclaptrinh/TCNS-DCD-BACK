import rewardPenaltyService from '@services/common/reward-penalty.service';

class RewardPenaltyController {
  createEntry = async (req, res, next) => {
    try {
      const data = await rewardPenaltyService.createEntry(req.body, req.user.id);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  getHistory = async (req, res, next) => {
    try {
      const data = await rewardPenaltyService.getHistory(req.user, req.parsedQuery);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getFinancialStats = async (req, res, next) => {
    try {
      const data = await rewardPenaltyService.getFinancialStats({
        ...(req.parsedQuery || {}),
        from: req.query.from,
        to: req.query.to,
        dateFrom: req.query.dateFrom || req.query.date_from,
        dateTo: req.query.dateTo || req.query.date_to,
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new RewardPenaltyController();
