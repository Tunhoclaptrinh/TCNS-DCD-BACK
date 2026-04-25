import BaseService from '@shared/common/base-service';
import dutySettingsRepository from '@modules/duty/repositories/duty-settings.repository';
import { GenericRecord } from './duty-utils';

class DutySettingService extends BaseService {
  constructor() {
    super('duty_settings', dutySettingsRepository);
  }

  async getSettings() {
    const s = await dutySettingsRepository.findOne({});
    if (!s) {
      return await dutySettingsRepository.create({
        weeklyKipLimit: 0,
        allowUnregisterWhenFull: false,
        allowSwap: true,
        allowLeaveRequest: true,
      });
    }
    return s;
  }

  async updateSettings(data: GenericRecord) {
    const s = await this.getSettings();
    return await dutySettingsRepository.update(s.id, data);
  }
}

export default new DutySettingService();
