import BaseService from '@shared/common/base-service';
import dutySettingsRepository from '@modules/duty/repositories/duty-settings.repository';
import { GenericRecord } from './duty-utils';

class DutySettingsService extends BaseService {
  constructor() {
    super('duty_settings', dutySettingsRepository);
  }

  async getSettings() {
    const settings = await dutySettingsRepository.getGlobalSettings();
    const defaults = {
      weeklyLimitEnabled: true,
      weeklyKipLimit: 0,
      allowUnregisterWhenFull: true,
      currentGeneration: '',
      generations: [],
      kipLimitMode: 'quota',
      defaultQuota: 2.5,
      kipPrice: 0,
      violationPenaltyRate: 0,
      quotaRules: [],
      penaltyAbsentNoPermission: 50000,
      penaltyAbsentWithPermissionLate: 20000,
      penaltyLate: 10000,
      allowedIpRanges: [] as string[],
      updatedAt: new Date().toISOString(),
    };

    if (!settings) return defaults;
    const plainSettings = typeof (settings as any).toObject === 'function' ? (settings as any).toObject() : settings;
    return { ...defaults, ...plainSettings };
  }

  /**
   * Alias for compatibility
   */
  async updateSettings(data: GenericRecord) {
    const settings = await dutySettingsRepository.getGlobalSettings();
    if (!settings) {
      return await this.create(data);
    }
    return await this.update(settings.id, data);
  }

  async beforeCreate(data: GenericRecord) {
    const payload = await this.processSettingsPayload(data);
    return {
      ...payload,
      createdAt: new Date().toISOString(),
    };
  }

  async beforeUpdate(id: any, data: GenericRecord) {
    return await this.processSettingsPayload(data, id);
  }

  private async processSettingsPayload(data: GenericRecord, _id?: any) {
    const settings = await dutySettingsRepository.getGlobalSettings();
    const payload = {
      weeklyLimitEnabled: data.hasOwnProperty('weeklyLimitEnabled')
        ? data.weeklyLimitEnabled === true || data.weeklyLimitEnabled === 'true'
        : settings
          ? settings.weeklyLimitEnabled
          : true,
      weeklyKipLimit: Number(data.weeklyKipLimit) || 0,
      allowUnregisterWhenFull: data.allowUnregisterWhenFull !== false,
      currentGeneration: data.currentGeneration || '',
      generations: Array.isArray(data.generations) ? data.generations : [],
      kipLimitMode: data.kipLimitMode || 'quota',
      defaultQuota: Number(data.defaultQuota) || 2.5,
      kipPrice: Number(data.kipPrice) || 0,
      violationPenaltyRate: Number(data.violationPenaltyRate) || 0,
      quotaRules: Array.isArray(data.quotaRules) ? data.quotaRules : [],
      penaltyAbsentNoPermission: Number(data.penaltyAbsentNoPermission) || 50000,
      penaltyAbsentWithPermissionLate: Number(data.penaltyAbsentWithPermissionLate) || 20000,
      penaltyLate: Number(data.penaltyLate) || 10000,
      allowedIpRanges: Array.isArray(data.allowedIpRanges)
        ? data.allowedIpRanges
        : typeof data.allowedIpRanges === 'string'
          ? data.allowedIpRanges
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      updatedAt: new Date().toISOString(),
    };
    return payload;
  }
}

export default new DutySettingsService();
