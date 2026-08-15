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
      updatedAt: new Date().toISOString(),
    };

    let result = defaults;
    if (settings) {
      const plainSettings = typeof (settings as any).toObject === 'function' ? (settings as any).toObject() : settings;
      result = { ...defaults, ...plainSettings };
      if (!Array.isArray(plainSettings.violationTypes) || plainSettings.violationTypes.length === 0) {
        result.violationTypes = defaults.violationTypes;
        try {
          const SystemSettingModel = (db as any).getModel('system_settings');
          if (SystemSettingModel) {
            const vDoc = await SystemSettingModel.findOne({ key: 'DUTY_VIOLATION_TYPES' }).lean();
            if (vDoc && vDoc.value) {
              const parsed = typeof vDoc.value === 'string' ? JSON.parse(vDoc.value) : vDoc.value;
              if (Array.isArray(parsed) && parsed.length > 0) {
                result.violationTypes = parsed;
              }
            }
          }
        } catch {
          // Ignore
        }
      }
    }

    // Merge ALLOWED_IP_RANGES from system_settings if present
    try {
      const SystemSettingModel = (db as any).getModel('system_settings');
      if (SystemSettingModel) {
        const ipDoc = await SystemSettingModel.findOne({ key: 'ALLOWED_IP_RANGES' }).lean();
        if (ipDoc && ipDoc.value) {
          result.allowedIpRanges = String(ipDoc.value)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        }
      }
    } catch {
      // Ignore system_settings lookup error
    }

    return result;
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
    const parsedIpRanges = Array.isArray(data.allowedIpRanges)
      ? data.allowedIpRanges
      : typeof data.allowedIpRanges === 'string'
        ? data.allowedIpRanges
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

    // Sync to system_settings as ALLOWED_IP_RANGES and DUTY_VIOLATION_TYPES
    try {
      const SystemSettingModel = (db as any).getModel('system_settings');
      if (SystemSettingModel && data.hasOwnProperty('allowedIpRanges')) {
        await SystemSettingModel.findOneAndUpdate(
          { key: 'ALLOWED_IP_RANGES' },
          { value: parsedIpRanges.join(', ') },
          { upsert: true, new: true },
        );
      }
      if (SystemSettingModel && data.hasOwnProperty('violationTypes')) {
        await SystemSettingModel.findOneAndUpdate(
          { key: 'DUTY_VIOLATION_TYPES' },
          {
            value: JSON.stringify(data.violationTypes),
            type: 'json',
            description: 'Cấu hình danh mục loại lỗi vi phạm ca trực và mức phạt mặc định',
          },
          { upsert: true, new: true },
        );
      }
    } catch {
      // Ignore system_settings write error
    }

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
      defaultQuota: data.defaultQuota !== undefined ? Number(data.defaultQuota) : (settings?.defaultQuota ?? 2.5),
      kipPrice: data.kipPrice !== undefined ? Number(data.kipPrice) : (settings?.kipPrice ?? 0),
      quotaRules: Array.isArray(data.quotaRules) ? data.quotaRules : settings?.quotaRules || [],
      penaltyAbsentNoPermission:
        data.penaltyAbsentNoPermission !== undefined
          ? Number(data.penaltyAbsentNoPermission)
          : (settings?.penaltyAbsentNoPermission ?? 50000),
      penaltyAbsentWithPermissionLate:
        data.penaltyAbsentWithPermissionLate !== undefined
          ? Number(data.penaltyAbsentWithPermissionLate)
          : (settings?.penaltyAbsentWithPermissionLate ?? 20000),
      penaltyLate: data.penaltyLate !== undefined ? Number(data.penaltyLate) : (settings?.penaltyLate ?? 10000),
      penaltyWrongUniform:
        data.penaltyWrongUniform !== undefined
          ? Number(data.penaltyWrongUniform)
          : (settings?.penaltyWrongUniform ?? 10000),
      violationPenaltyRate:
        data.violationPenaltyRate !== undefined
          ? Number(data.violationPenaltyRate)
          : (settings?.violationPenaltyRate ?? 0),
      violationTypes: Array.isArray(data.violationTypes) ? data.violationTypes : settings?.violationTypes || [],
      allowedIpRanges: parsedIpRanges,
      updatedAt: new Date().toISOString(),
    };
    return payload;
  }
}

export default new DutySettingsService();
