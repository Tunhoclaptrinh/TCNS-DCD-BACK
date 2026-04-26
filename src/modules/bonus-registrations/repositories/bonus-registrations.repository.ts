import BaseRepository from '@shared/repositories/base.repository';

class BonusRegistrationsRepository extends BaseRepository {
  constructor() {
    super('bonus_registrations');
  }

  async findByCampaignAndUser(campaignId: number, userId: number) {
    const result = await this.findAllAdvanced({
      filter: { campaignId, userId },
      limit: 1,
    });
    return result.data?.[0] || null;
  }

  async findByCampaign(campaignId: number) {
    const result = await this.findAllAdvanced({
      filter: { campaignId },
      limit: 1000,
    });
    return result.data || [];
  }
}

export default new BonusRegistrationsRepository();
