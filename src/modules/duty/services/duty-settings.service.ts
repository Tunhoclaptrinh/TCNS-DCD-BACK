import dutySettingsRepository from '@modules/duty/repositories/duty-settings.repository';
import { GenericRecord } from './duty-utils';

class DutySettingsService {
  async getSettings() {
    const settings = await dutySettingsRepository.getGlobalSettings();
    if (!settings) {
      return {
        weeklyKipLimit: 0,
        allowUnregisterWhenFull: true,
        currentGeneration: '',
        generations: [],
        defaultQuota: 2.5,
        kipPrice: 0,
        violationPenaltyRate: 0,
        quotaRules: [],
        updatedAt: new Date().toISOString(),
      };
    }
    return settings;
  }

  async updateSettings(data: GenericRecord) {
    const settings = await dutySettingsRepository.getGlobalSettings();
    const payload = {
      weeklyKipLimit: Number(data.weeklyKipLimit) || 0,
      allowUnregisterWhenFull: data.allowUnregisterWhenFull !== false,
      currentGeneration: data.currentGeneration || '',
      generations: Array.isArray(data.generations) ? data.generations : [],
      defaultQuota: Number(data.defaultQuota) || 2.5,
      kipPrice: Number(data.kipPrice) || 0,
      violationPenaltyRate: Number(data.violationPenaltyRate) || 0,
      quotaRules: Array.isArray(data.quotaRules) ? data.quotaRules : [],
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
