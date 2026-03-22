const mongoose = require('mongoose');
const url = 'mongodb+srv://phongbye01_db_user:rUdRjWAh681gk05p@tcns.ggkhtte.mongodb.net/tcns_dev?appName=TCNS';

async function debug() {
  console.log('Connecting...');
  await mongoose.connect(url);
  console.log('Connected.');
  
  const dateStr = '2026-03-20';
  const d = new Date(dateStr);
  d.setUTCHours(0,0,0,0);
  
  console.log('Searching for shiftDate:', d.toISOString());
  
  const slots = await mongoose.connection.db.collection('duty_slots').find({
    shiftDate: d
  }).toArray();
  
  console.log(`Found ${slots.length} slots for ${dateStr} at UTC midnight`);
  slots.forEach(s => {
    console.log(`- ID: ${s.id}, Label: ${s.shiftLabel}, shiftId: ${s.shiftId} (${typeof s.shiftId})`);
  });
  
  process.exit(0);
}

debug().catch(console.error);
