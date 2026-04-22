import BaseRepository from '@shared/repositories/base.repository';

class DutySettingsRepository extends BaseRepository {
  constructor() {
    super('duty_settings');
  }

  async getGlobalSettings() {
    const all = await this.findAll();
    return all.length > 0 ? all[0] : null;
  }
}

export default new DutySettingsRepository();
