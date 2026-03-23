import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/base';

async function clearDutyData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.');

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
      await mongoose.connection.collection(colName).deleteMany({});
    }

    console.log('Successfully cleared all duty-related data.');
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

clearDutyData();
