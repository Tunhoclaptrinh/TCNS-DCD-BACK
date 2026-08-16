import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import db, { initDatabase } from '../database/mongo-database.adapter';

dns.setServers(['8.8.8.8', '1.1.1.1']);

dotenv.config({ path: path.join(__dirname, '../../.env') });

const DEFAULT_DEPARTMENTS = [
  {
    id: 'nhan-su',
    name: 'Nhân sự',
    roles: {
      tb: ['ns_leader'],
      pb: ['ns_sub_leader'],
      tvb: ['ns_specialist'],
    },
  },
  {
    id: 'truyen-thong',
    name: 'Truyền thông',
    roles: {
      tb: ['tt_leader'],
      pb: ['tt_sub_leader'],
      tvb: ['member'],
    },
  },
  {
    id: 'tai-chinh',
    name: 'Tài chính',
    roles: {
      tb: ['tc_leader'],
      pb: ['tc_sub_leader'],
      tvb: ['member'],
    },
  },
  {
    id: 'khac',
    name: 'Khác',
    roles: {
      tb: ['other_leader'],
      pb: ['other_sub_leader'],
      tvb: ['member'],
    },
  },
];

const DEFAULT_POSITIONS = [
  { id: 'ctv', name: 'Cộng tác viên', requiresDept: false, noDeptAllowed: false, isDefault: true },
  { id: 'tv', name: 'Thành viên thường', requiresDept: false, noDeptAllowed: false, isDefault: true },
  { id: 'tvb', name: 'Thành viên ban', requiresDept: true, noDeptAllowed: false, isDefault: true },
  { id: 'pb', name: 'Phó ban', requiresDept: true, noDeptAllowed: false, isDefault: true },
  { id: 'tb', name: 'Trưởng ban', requiresDept: true, noDeptAllowed: false, isDefault: true },
  { id: 'dt', name: 'Đội trưởng', requiresDept: false, noDeptAllowed: true, isDefault: true },
];

async function seedDepartmentConfig() {
  try {
    const mongoUrl = process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('DATABASE_URL is not defined in .env');
    }

    console.log('Connecting to database...');
    await initDatabase();

    console.log('Seeding DEPARTMENT_CONFIGS into system_settings...');

    // Check if DEPARTMENT_CONFIGS exists
    const existingDept = await db.findOne('system_settings', { key: 'DEPARTMENT_CONFIGS' });
    if (existingDept) {
      console.log('DEPARTMENT_CONFIGS already exists, updating...');
      await db.update('system_settings', existingDept.id, {
        value: JSON.stringify(DEFAULT_DEPARTMENTS),
        type: 'json',
      });
    } else {
      console.log('Creating new DEPARTMENT_CONFIGS...');
      await db.create('system_settings', {
        key: 'DEPARTMENT_CONFIGS',
        value: JSON.stringify(DEFAULT_DEPARTMENTS),
        type: 'json',
        description: 'Cấu hình danh sách phòng ban và RBAC tự động theo chức vụ',
      });
    }

    console.log('Seeding POSITION_CONFIGS into system_settings...');

    // Check if POSITION_CONFIGS exists
    const existingPos = await db.findOne('system_settings', { key: 'POSITION_CONFIGS' });
    if (existingPos) {
      console.log('POSITION_CONFIGS already exists, updating...');
      await db.update('system_settings', existingPos.id, {
        value: JSON.stringify(DEFAULT_POSITIONS),
        type: 'json',
      });
    } else {
      console.log('Creating new POSITION_CONFIGS...');
      await db.create('system_settings', {
        key: 'POSITION_CONFIGS',
        value: JSON.stringify(DEFAULT_POSITIONS),
        type: 'json',
        description: 'Cấu hình danh sách chức vụ hệ thống và quy tắc gán ban chuyên môn',
      });
    }

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

seedDepartmentConfig();
