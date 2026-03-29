import BaseRepository from '@shared/repositories/base.repository';
import type { AnyRecord, Identifier } from '@app-types/common';

class NotificationsRepository extends BaseRepository {
  private readonly settingsRepository = new BaseRepository('notification_settings');

  constructor() {
    super('notifications');
  }

  async findSettingsByUserId(userId: Identifier) {
    return await this.settingsRepository.findOne({ userId });
  }

  async createSettings(payload: AnyRecord) {
    return await this.settingsRepository.create(payload);
  }

  async updateSettings(settingsId: Identifier, payload: AnyRecord) {
    return await this.settingsRepository.update(settingsId, payload);
  }

  async findAllByUserId(userId: Identifier) {
    return await this.findMany({ userId });
  }

  async findUnreadByUserId(userId: Identifier) {
    return await this.findMany({ userId, isRead: false });
  }

  async countUnreadByUserId(userId: Identifier) {
    return await this.count({ userId, isRead: false });
  }

  async findAdvancedByUserId(userId: Identifier, options: AnyRecord = {}) {
    return await this.findAllAdvanced({
      ...options,
      filter: {
        ...(options.filter || {}),
        userId,
      },
    });
  }

  async deleteAllByUserId(userId: Identifier) {
    return await this.deleteMany({ userId });
  }

  async deleteAllSettingsByUserId(userId: Identifier) {
    return await this.settingsRepository.deleteMany({ userId });
  }
}

export default new NotificationsRepository();
