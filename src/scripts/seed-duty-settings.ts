import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import db, { initDatabase } from '../database/mongo-database.adapter';
import dutySettingsRepository from '../modules/duty/repositories/duty-settings.repository';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config({ path: path.join(__dirname, '../../.env') });

export const DEFAULT_VIOLATION_TYPES = [
  {
    key: 'absent_no_permission',
    label: 'Vắng mặt không phép',
    defaultPenalty: 50000,
    defaultCoeff: 1,
    description: 'Không có mặt tại kíp trực và không có đơn xin phép hợp lệ được phê duyệt',
  },
  {
    key: 'late',
    label: 'Đi muộn',
    defaultPenalty: 10000,
    defaultCoeff: 1,
    description: 'Có mặt muộn sau giờ bắt đầu ca trực quy định',
  },
  {
    key: 'absent_with_permission_late',
    label: 'Báo muộn',
    defaultPenalty: 20000,
    defaultCoeff: 1,
    description: 'Xin nghỉ hoặc báo vắng sát giờ / sau thời hạn cho phép',
  },
  {
    key: 'wrong_uniform',
    label: 'Sai tác phong / trang phục',
    defaultPenalty: 10000,
    defaultCoeff: 1,
    description: 'Không mặc đúng đồng phục, không đeo thẻ hoặc vi phạm tác phong làm việc',
  },
  {
    key: 'other',
    label: 'Khác (Ghi chú chi tiết)',
    defaultPenalty: 0,
    defaultCoeff: 1,
    description: 'Các vi phạm phát sinh khác được quản trị viên hoặc quản lý kíp ghi nhận cụ thể',
  },
];

const DEFAULT_DUTY_SETTINGS = {
  weeklyLimitEnabled: true,
  weeklyKipLimit: 0,
  allowUnregisterWhenFull: true,
  currentGeneration: '',
  generations: [],
  kipLimitMode: 'quota',
  defaultQuota: 4,
  kipPrice: 0,
  quotaRules: [],
  penaltyAbsentNoPermission: 50000,
  penaltyAbsentWithPermissionLate: 20000,
  penaltyLate: 10000,
  penaltyWrongUniform: 10000,
  violationPenaltyRate: 1,
  violationTypes: DEFAULT_VIOLATION_TYPES,
  allowedIpRanges: [] as string[],
  selfCheckInBeforeMinutes: 15,
  updatedAt: new Date().toISOString(),
};

async function seedDutySettings() {
  try {
    const mongoUrl = process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('DATABASE_URL is not defined in .env');
    }

    console.log('Connecting to database...');
    await initDatabase();

    console.log('Seeding default duty settings & violation types into duty_settings...');

    const existing = await dutySettingsRepository.getGlobalSettings();
    if (existing) {
      console.log('Found existing duty_settings, updating with new violation types & penalties...');
      const existingData = typeof (existing as any).toObject === 'function' ? (existing as any).toObject() : existing;

      const existingList = Array.isArray(existingData.violationTypes) ? existingData.violationTypes : [];
      const mergedViolationTypes = [...existingList];
      for (const defType of DEFAULT_VIOLATION_TYPES) {
        const existingIdx = mergedViolationTypes.findIndex((vt) => vt.key === defType.key);
        if (existingIdx === -1) {
          mergedViolationTypes.push(defType);
        } else {
          mergedViolationTypes[existingIdx] = {
            ...defType,
            ...mergedViolationTypes[existingIdx],
          };
        }
      }

      await db.update('duty_settings', existing.id, {
        ...DEFAULT_DUTY_SETTINGS,
        ...existingData,
        selfCheckInBeforeMinutes: existingData.selfCheckInBeforeMinutes ?? 15,
        penaltyWrongUniform: existingData.penaltyWrongUniform ?? 10000,
        violationTypes: mergedViolationTypes,
        updatedAt: new Date().toISOString(),
      });
      console.log('Successfully updated duty_settings!');
    } else {
      console.log('Creating initial duty_settings document...');
      await db.create('duty_settings', {
        ...DEFAULT_DUTY_SETTINGS,
        createdAt: new Date().toISOString(),
      });
      console.log('Successfully created initial duty_settings!');
    }

    console.log('Seeding DUTY_VIOLATION_TYPES into system_settings...');
    const existingSysSetting = await db.findOne('system_settings', { key: 'DUTY_VIOLATION_TYPES' });
    if (existingSysSetting) {
      await db.update('system_settings', existingSysSetting.id, {
        value: JSON.stringify(DEFAULT_VIOLATION_TYPES),
        type: 'json',
        description: 'Cấu hình danh mục loại lỗi vi phạm ca trực và mức phạt mặc định',
      });
      console.log('Successfully updated DUTY_VIOLATION_TYPES in system_settings!');
    } else {
      await db.create('system_settings', {
        key: 'DUTY_VIOLATION_TYPES',
        value: JSON.stringify(DEFAULT_VIOLATION_TYPES),
        type: 'json',
        description: 'Cấu hình danh mục loại lỗi vi phạm ca trực và mức phạt mặc định',
      });
      console.log('Successfully created DUTY_VIOLATION_TYPES in system_settings!');
    }

    const existingSelfCheckIn = await db.findOne('system_settings', { key: 'SELF_CHECKIN_BEFORE_MINUTES' });
    if (!existingSelfCheckIn) {
      await db.create('system_settings', {
        key: 'SELF_CHECKIN_BEFORE_MINUTES',
        value: '15',
        type: 'number',
        description: 'Số phút được phép tự điểm danh trước khi kíp trực bắt đầu',
      });
      console.log('Successfully created SELF_CHECKIN_BEFORE_MINUTES in system_settings!');
    } else if (existingSelfCheckIn.value !== '15') {
      await db.update('system_settings', (existingSelfCheckIn as any)._id || (existingSelfCheckIn as any).id, {
        value: '15',
      });
      console.log('Successfully synced SELF_CHECKIN_BEFORE_MINUTES to 15 in system_settings!');
    }

    console.log('Seeding duty settings completed successfully!');
  } catch (error) {
    console.error('Seeding duty settings failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

if (require.main === module) {
  seedDutySettings();
}

export default seedDutySettings;
