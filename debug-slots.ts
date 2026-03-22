import { MongoConnect } from './src/config/mongo-connect';
import dayjs from 'dayjs';

async function debug() {
  const db = new MongoConnect();
  await db.connect();
  const dateStr = '2026-03-20';
  const d = dayjs(dateStr).startOf('day').toDate();
  console.log('Searching for:', d.toISOString());

  const slots = await db.findMany('duty_slots', { shiftDate: d });
  console.log(`Found ${slots.length} slots for ${dateStr}`);
  slots.forEach((s) => {
    console.log(`- ID: ${s.id}, Label: ${s.shiftLabel}, shiftId: ${s.shiftId} (${typeof s.shiftId})`);
  });

  process.exit(0);
}

debug();
