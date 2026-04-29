import bonusCampaignService from '@modules/bonus-campaigns/services/bonus-campaign.service';
import BaseController from '@shared/common/base-controller';

class BonusCampaignController extends BaseController {
  getCampaigns = this.handle(async (req, res) => {
    const data = await bonusCampaignService.listCampaigns(req.user, {
      ...(req.parsedQuery || {}),
      openOnly: req.query.openOnly || req.query.open_only,
    });
    this.ok(res, data);
  });

  getCampaignById = this.handle(async (req, res) => {
    const data = await bonusCampaignService.getCampaignById(req.params.id, req.user);
    this.ok(res, data);
  });

  createCampaign = this.handle(async (req, res) => {
    const data = await bonusCampaignService.createCampaign(req.body, req.user.id);
    this.created(res, data);
  });

  updateCampaign = this.handle(async (req, res) => {
    const data = await bonusCampaignService.updateCampaign(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  deleteCampaign = this.handle(async (req, res) => {
    const data = await bonusCampaignService.deleteCampaign(req.params.id, req.user.id);
    this.ok(res, data);
  });

  registerCampaign = this.handle(async (req, res) => {
    const data = await bonusCampaignService.registerCampaign(req.params.id, req.user);
    this.ok(res, data);
  });

  reviewCampaign = this.handle(async (req, res) => {
    const data = await bonusCampaignService.reviewCampaign(req.params.id, req.body, req.user.id);
    this.ok(res, data);
  });

  exportApprovedExcel = this.handle(async (req, res) => {
    const output = await bonusCampaignService.exportApprovedExcel(req.params.id);

    res.setHeader('Content-Type', output.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${output.filename}"`);
    res.send(output.buffer);
  });
}

export default new BonusCampaignController();
