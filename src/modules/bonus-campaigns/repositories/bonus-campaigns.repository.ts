import BaseRepository from '@shared/repositories/base.repository';

class BonusCampaignsRepository extends BaseRepository {
  constructor() {
    super('bonus_campaigns');
  }
}

export default new BonusCampaignsRepository();
