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
        ...req.query,
        ...(req.parsedQuery || {}),
      });
      res.json(data);
    } catch (error) {
      next(error);
    }
  };
}

export default new RewardPenaltyController();
