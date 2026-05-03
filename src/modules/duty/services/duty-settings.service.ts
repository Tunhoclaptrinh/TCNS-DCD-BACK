import dutySettingsRepository from '@modules/duty/repositories/duty-settings.repository';
import { GenericRecord } from './duty-utils';

class DutySettingsService {
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

  async updateSettings(data: GenericRecord) {
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

    console.log('[DutySettings] Saving settings with payload:', JSON.stringify(payload, null, 2));

    if (!settings) {
      const created = await dutySettingsRepository.create(payload);
      console.log('[DutySettings] Created new settings document');
      return created;
    }
    const updated = await dutySettingsRepository.update(settings.id, payload);
    console.log('[DutySettings] Updated existing settings document');
    return updated;
  }
}

export default new DutySettingsService();
