import BaseService from '@shared/common/base-service';
import dutyPeriodConfigsRepository from '../repositories/duty-period-configs.repository';
import dayjs from 'dayjs';

class DutyPeriodConfigsService extends BaseService {
  constructor() {
    super('duty_period_configs', dutyPeriodConfigsRepository);
  }

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

    // Return empty config for uninitialized periods with system defaults
    return {
      startDate: start,
      endDate: end,
      defaultQuota: 2.5, // Hardcoded fallback as requested
      kipPrice: 0,
      violationPenaltyRate: 0,
      quotaRules: [],
      isInitialized: false,
    };
  }

  /**
   * Upsert configuration by date range
   */
  async updateConfig(payload: any) {
    const { startDate, endDate } = payload;
    if (!startDate || !endDate) throw new Error('startDate and endDate are required');

    const start = dayjs(startDate).startOf('day').toDate();
    const end = dayjs(endDate).endOf('day').toDate();

    const existing = await dutyPeriodConfigsRepository.findByRange(start, end);

    if (existing) {
      return await this.update(existing.id, payload);
    }
    return await this.create(payload);
  }

  async beforeCreate(payload: any) {
    const start = dayjs(payload.startDate).startOf('day').toDate();
    const end = dayjs(payload.endDate).endOf('day').toDate();

    return {
      ...(await super.beforeCreate(payload)),
      startDate: start,
      endDate: end,
      isInitialized: true,
    };
  }

  async beforeUpdate(id: any, payload: any) {
    const start = payload.startDate ? dayjs(payload.startDate).startOf('day').toDate() : undefined;
    const end = payload.endDate ? dayjs(payload.endDate).endOf('day').toDate() : undefined;

    return {
      ...(await super.beforeUpdate(id, payload)),
      ...(start ? { startDate: start } : {}),
      ...(end ? { endDate: end } : {}),
      isInitialized: true,
    };
  }
}

export default new DutyPeriodConfigsService();
