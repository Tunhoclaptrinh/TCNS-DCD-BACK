import BaseService from '@shared/common/base-service';
import db from '@database/mongo-database.adapter';
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
      quotaRules: [],
      penaltyAbsentNoPermission: 50000,
      penaltyAbsentWithPermissionLate: 20000,
      penaltyLate: 10000,
      penaltyWrongUniform: 10000,
      violationTypes: [
        { key: 'absent_no_permission', label: 'Vắng mặt không phép', defaultPenalty: 50000, defaultCoeff: 1 },
        { key: 'late', label: 'Đi muộn', defaultPenalty: 10000, defaultCoeff: 1 },
        { key: 'absent_with_permission_late', label: 'Báo muộn', defaultPenalty: 20000, defaultCoeff: 1 },
        { key: 'wrong_uniform', label: 'Sai tác phong / trang phục', defaultPenalty: 10000, defaultCoeff: 1 },
        { key: 'other', label: 'Khác (Ghi chú chi tiết)', defaultPenalty: 0, defaultCoeff: 1 },
      ],
      isPrivacyMode: false,
      violationPenaltyRate: 0,
      allowedIpRanges: [] as string[],
      selfCheckInBeforeMinutes: 15,
      selfCheckInAfterMinutes: 15,
      updatedAt: new Date().toISOString(),
    };

    if (settings) {
      const plainSettings = typeof (settings as any).toObject === 'function' ? (settings as any).toObject() : settings;
      return { ...defaults, ...plainSettings };
    }
    return defaults;
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

  async create(data: GenericRecord) {
    if (typeof data.allowedIpRanges === 'string') {
      data.allowedIpRanges = data.allowedIpRanges
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return super.create(data);
  }

  async update(id: any, data: GenericRecord) {
    if (typeof data.allowedIpRanges === 'string') {
      data.allowedIpRanges = data.allowedIpRanges
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
    }
    return super.update(id, data);
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
    const rawIp = data.allowedIpRanges !== undefined ? data.allowedIpRanges : data.ALLOWED_IP_RANGES;
    const parsedIpRanges = Array.isArray(rawIp)
      ? rawIp
      : typeof rawIp === 'string'
        ? rawIp
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : settings?.allowedIpRanges || [];

    const vTypes = Array.isArray(data.violationTypes) ? data.violationTypes : settings?.violationTypes || [];
    const findPen = (keyStr: string, fallbackVal: number) => {
      const item = vTypes.find((v: any) => v.key === keyStr);
      return item && item.defaultPenalty !== undefined ? Number(item.defaultPenalty) : fallbackVal;
    };

    const payload = {
      weeklyLimitEnabled: data.hasOwnProperty('weeklyLimitEnabled')
        ? data.weeklyLimitEnabled === true || data.weeklyLimitEnabled === 'true'
        : (settings?.weeklyLimitEnabled ?? true),
      weeklyKipLimit: data.weeklyKipLimit !== undefined ? Number(data.weeklyKipLimit) : (settings?.weeklyKipLimit ?? 2),
      allowUnregisterWhenFull: data.hasOwnProperty('allowUnregisterWhenFull')
        ? data.allowUnregisterWhenFull === true || data.allowUnregisterWhenFull === 'true'
        : (settings?.allowUnregisterWhenFull ?? false),
      currentGeneration: data.currentGeneration || '',
      generations: Array.isArray(data.generations) ? data.generations : [],
      kipLimitMode: data.kipLimitMode || 'quota',
      defaultQuota: data.defaultQuota !== undefined ? Number(data.defaultQuota) : (settings?.defaultQuota ?? 2.5),
      kipPrice: data.kipPrice !== undefined ? Number(data.kipPrice) : (settings?.kipPrice ?? 0),
      quotaRules: Array.isArray(data.quotaRules) ? data.quotaRules : settings?.quotaRules || [],
      penaltyAbsentNoPermission:
        data.penaltyAbsentNoPermission !== undefined
          ? Number(data.penaltyAbsentNoPermission)
          : findPen('absent_no_permission', settings?.penaltyAbsentNoPermission ?? 50000),
      penaltyAbsentWithPermissionLate:
        data.penaltyAbsentWithPermissionLate !== undefined
          ? Number(data.penaltyAbsentWithPermissionLate)
          : findPen('absent_with_permission_late', settings?.penaltyAbsentWithPermissionLate ?? 20000),
      penaltyLate:
        data.penaltyLate !== undefined ? Number(data.penaltyLate) : findPen('late', settings?.penaltyLate ?? 10000),
      penaltyWrongUniform:
        data.penaltyWrongUniform !== undefined
          ? Number(data.penaltyWrongUniform)
          : findPen('wrong_uniform', settings?.penaltyWrongUniform ?? 10000),
      violationPenaltyRate:
        data.violationPenaltyRate !== undefined
          ? Number(data.violationPenaltyRate)
          : (settings?.violationPenaltyRate ?? 0),
      violationTypes: vTypes,
      allowedIpRanges: parsedIpRanges,
      selfCheckInBeforeMinutes:
        data.selfCheckInBeforeMinutes !== undefined
          ? Number(data.selfCheckInBeforeMinutes)
          : data.SELF_CHECKIN_BEFORE_MINUTES !== undefined
            ? Number(data.SELF_CHECKIN_BEFORE_MINUTES)
            : (settings?.selfCheckInBeforeMinutes ?? 15),
      selfCheckInAfterMinutes:
        data.selfCheckInAfterMinutes !== undefined
          ? Number(data.selfCheckInAfterMinutes)
          : data.SELF_CHECKIN_AFTER_MINUTES !== undefined
            ? Number(data.SELF_CHECKIN_AFTER_MINUTES)
            : (settings?.selfCheckInAfterMinutes ?? 15),
      updatedAt: new Date().toISOString(),
    };
    return payload;
  }
}

export default new DutySettingsService();
