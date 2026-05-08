import BaseService from '@shared/common/base-service';
import bonusRegistrationsRepository from '@modules/bonus-registrations/repositories/bonus-registrations.repository';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
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

  async createRegistration(data: AnyRecord, actorId?: Identifier) {
    const now = new Date().toISOString();
    const created = await this.repository.create({
      ...data,
    });

    await auditLogsService.log({
      userId: Number(actorId ?? created.userId) || 0,
      action: 'TẠO ĐĂNG KÝ ĐIỂM THƯỞNG',
      module: 'BONUS_REGISTRATIONS',
      description: `Tạo đăng ký điểm thưởng #${created.id} cho người dùng #${created.userId}`,
      resourceId: String(created.id),
    });

    return created;
  }

  async updateRegistration(id: Identifier, data: AnyRecord, actorId?: Identifier) {
    const updated = await this.repository.update(id, {
      ...data,
    });

    if (updated) {
      await auditLogsService.log({
        userId: Number(actorId ?? updated.reviewedBy ?? updated.userId) || 0,
        action: 'CẬP NHẬT ĐĂNG KÝ ĐIỂM THƯỞNG',
        module: 'BONUS_REGISTRATIONS',
        description: `Cập nhật đăng ký điểm thưởng #${updated.id}`,
        resourceId: String(updated.id),
      });
    }

    return updated;
  }
}

export default new BonusRegistrationService();
