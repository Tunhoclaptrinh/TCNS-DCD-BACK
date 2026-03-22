const mongoose = require('mongoose');
const url = 'mongodb+srv://phongbye01_db_user:rUdRjWAh681gk05p@tcns.ggkhtte.mongodb.net/tcns_dev?appName=TCNS';

async function debug() {
  console.log('Connecting...');
  await mongoose.connect(url);
  console.log('Connected.');
  
  const slotSchema = new mongoose.Schema({
    id: Number,
    shiftDate: Date,
    shiftLabel: String,
    status: String,
    assignedUserIds: [Number],
  }, { collection: 'duty_slots' });
  
  const Slot = mongoose.model('Slot', slotSchema);
  
  console.log('\n--- SLOTS FOR TODAY (MARCH 22) ---');
  const start = new Date('2026-03-22T00:00:00Z');
  const end = new Date('2026-03-22T23:59:59Z');
  
  const todaySlots = await Slot.find({ shiftDate: { $gte: start, $lte: end } });
  todaySlots.forEach(s => {
     console.log(`[${s.id}] ${s.shiftLabel} | Date: ${s.shiftDate.toISOString()} | Users: ${s.assignedUserIds}`);
  });
  
  console.log('\n--- SLOTS FOR RECENT DAYS ---');
  const recent = await Slot.find({ shiftDate: { $gte: new Date('2026-03-15T00:00:00Z') } }).sort({ shiftDate: 1 });
  recent.forEach(s => {
    console.log(`[${s.id}] ${s.shiftLabel} | Date: ${s.shiftDate.toISOString()}`);
  });

  await mongoose.disconnect();
}

debug().catch(console.error);
