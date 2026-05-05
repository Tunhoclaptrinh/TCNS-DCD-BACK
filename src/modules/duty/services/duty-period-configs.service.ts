import dutyPeriodConfigsRepository from '../repositories/duty-period-configs.repository';
import dutySettingsService from './duty-settings.service';
import dayjs from 'dayjs';

class DutyPeriodConfigsService {
  async getConfig(startDate: string, endDate: string) {
    const start = dayjs(startDate).startOf('day').toDate();
    const end = dayjs(endDate).endOf('day').toDate();

    const config = await dutyPeriodConfigsRepository.findByRange(start, end);
    if (config) {
      return {
        ...config,
        isInitialized: true,
      };
    }

    // Return empty config for uninitialized periods
    return {
      startDate: start,
      endDate: end,
      defaultQuota: 0, // No default quota unless explicitly set
      kipPrice: 0,
      violationPenaltyRate: 0,
      quotaRules: [],
      isInitialized: false,
    };
  }

  async updateConfig(payload: any) {
    const { startDate, endDate } = payload;
    if (!startDate || !endDate) throw new Error('startDate and endDate are required');

    const start = dayjs(startDate).startOf('day').toDate();
    const end = dayjs(endDate).endOf('day').toDate();

    const existing = await dutyPeriodConfigsRepository.findByRange(start, end);

    const data = {
      ...payload,
      startDate: start,
      endDate: end,
      isInitialized: true,
      updatedAt: new Date(),
    };

    if (existing) {
      return await dutyPeriodConfigsRepository.update(existing.id, data);
    } else {
      return await dutyPeriodConfigsRepository.create(data);
    }
  }
}

export default new DutyPeriodConfigsService();
