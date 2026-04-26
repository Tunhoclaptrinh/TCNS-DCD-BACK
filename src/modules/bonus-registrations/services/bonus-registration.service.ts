import BaseService from '@shared/common/base-service';
import bonusRegistrationsRepository from '@modules/bonus-registrations/repositories/bonus-registrations.repository';
import type { AnyRecord, Identifier } from '@app-types/common';

class BonusRegistrationService extends BaseService {
  constructor() {
    super('bonus_registrations', bonusRegistrationsRepository);
  }

  async getByCampaign(campaignId: number) {
    return await (this.repository as any).findByCampaign(campaignId);
  }

  async getByUserAndCampaign(userId: number, campaignId: number) {
    return await (this.repository as any).findByCampaignAndUser(campaignId, userId);
  }

  async createRegistration(data: AnyRecord) {
    const now = new Date().toISOString();
    return await this.repository.create({
      ...data,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updateRegistration(id: Identifier, data: AnyRecord) {
    return await this.repository.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }
}

export default new BonusRegistrationService();
