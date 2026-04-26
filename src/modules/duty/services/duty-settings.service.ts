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
      updatedAt: new Date().toISOString(),
    };

    if (!settings) {
      return await dutySettingsRepository.create(payload);
    }
    return await dutySettingsRepository.update(settings.id, payload);
  }
}

export default new DutySettingsService();
