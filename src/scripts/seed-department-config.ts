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

async function seedDepartmentConfig() {
  try {
    const mongoUrl = process.env.DATABASE_URL;
    if (!mongoUrl) {
      throw new Error('DATABASE_URL is not defined in .env');
    }

    console.log('Connecting to database...');
    await initDatabase();

    console.log('Seeding DEPARTMENT_CONFIGS into system_settings...');

    // Check if it already exists
    const existing = await db.findOne('system_settings', { key: 'DEPARTMENT_CONFIGS' });
    if (existing) {
      console.log('DEPARTMENT_CONFIGS already exists, updating...');
      await db.update('system_settings', existing.id, {
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

    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from database.');
  }
}

seedDepartmentConfig();
