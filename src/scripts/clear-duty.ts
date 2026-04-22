import dotenv from 'dotenv';
import path from 'path';
import db, { initDatabase } from '@database';

dotenv.config({ path: path.join(process.cwd(), '.env') });

async function clearDutyData() {
  try {
    console.log('Initializing Database...');
    await initDatabase();
    console.log('Database initialized successfully.');

    const collections = [
      'duty_templates',
      'duty_shifts',
      'duty_kips',
      'duty_slots',
      'duty_swap_requests',
      'duty_days',
      'duty_leave_requests',
    ];

    for (const colName of collections) {
      console.log(`Clearing collection: ${colName}...`);
      await db.deleteMany(colName, {});
    }

    console.log('Successfully cleared all duty-related data.');
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    process.exit(0);
  }
}

clearDutyData();
