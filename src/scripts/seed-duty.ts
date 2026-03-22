import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);
dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGODB_URI = process.env.DATABASE_URL || 'mongodb://127.0.0.1:27017/base';

async function seedDutyData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully.');

    const dbObj = mongoose.connection.db;

    // 0. Clear existing data
    const collections = [
      'duty_shifts',
      'duty_kips',
      'duty_slots',
      'duty_leave_requests',
      'duty_swap_requests',
      'duty_days',
    ];
    for (const colName of collections) {
      console.log(`Clearing collection: ${colName}...`);
      await dbObj.collection(colName).deleteMany({});
    }

    // 1. Create Shift Templates
    console.log('Creating Shift Templates...');
    const shifts = [
      { id: 1, name: 'Ca Sáng', startTime: '06:30', endTime: '10:30', order: 1, description: 'Trực khung giờ sáng' },
      { id: 2, name: 'Ca Chiều', startTime: '12:30', endTime: '16:30', order: 2, description: 'Trực khung giờ chiều' },
      { id: 3, name: 'Ca Tối', startTime: '18:30', endTime: '22:30', order: 3, description: 'Trực khung giờ tối' },
    ];
    await dbObj.collection('duty_shifts').insertMany(shifts);

    // 2. Create Kip Templates
    console.log('Creating Kip Templates...');
    const kips = [
      // Morning (Ca 1)
      {
        id: 1,
        shiftId: 1,
        name: 'Kíp 1',
        startTime: '06:45',
        endTime: '08:45',
        coefficient: 1,
        capacity: 5,
        order: 1,
        endPeriod: 2,
        daysOfWeek: [0, 1, 2, 3, 4, 5],
        description: 'Phòng trực A1',
      },
      {
        id: 2,
        shiftId: 1,
        name: 'Kíp 2',
        startTime: '08:45',
        endTime: '10:15',
        coefficient: 1,
        capacity: 5,
        order: 3,
        endPeriod: 4,
        daysOfWeek: [0, 1, 2, 3, 4],
        description: 'Sảnh chính Tòa nhà',
      },

      // Afternoon (Ca 2)
      {
        id: 3,
        shiftId: 2,
        name: 'Kíp 3',
        startTime: '12:45',
        endTime: '14:45',
        coefficient: 1,
        capacity: 5,
        order: 7,
        endPeriod: 9,
        daysOfWeek: [0, 1, 2, 3, 4],
        description: 'Tuần tra khu vực B',
      },
      {
        id: 4,
        shiftId: 2,
        name: 'Kíp 4',
        startTime: '14:45',
        endTime: '16:15',
        coefficient: 1,
        capacity: 3,
        order: 10,
        endPeriod: 11,
        daysOfWeek: [0, 2, 4],
        description: 'Hỗ trợ kỹ thuật',
      },

      // Evening (Ca 3)
      {
        id: 5,
        shiftId: 3,
        name: 'Kíp 5',
        startTime: '19:00',
        endTime: '20:15',
        coefficient: 1.5,
        capacity: 2,
        order: 13,
        endPeriod: 14,
        daysOfWeek: [0, 1, 2, 5, 6],
        description: 'Trực ban đêm',
      },
    ];
    await dbObj.collection('duty_kips').insertMany(kips);

    // 3. Generate Days and Slots for the Entire Current Month
    console.log('Generating Days and Slots for the current month...');
    const now = dayjs();
    // Seed for 6 weeks around today (2 weeks past, 4 weeks future)
    let current = now.subtract(2, 'weeks').startOf('isoWeek' as any);
    const endWindow = now.add(4, 'weeks').endOf('isoWeek' as any);
    const days = [];
    const slots = [];
    let dayIdCounter = 1;
    let slotIdCounter = 1;

    while (current.isBefore(endWindow) || current.isSame(endWindow, 'day')) {
      // Force date to UTC 00:00:00
      const d = new Date(current.format('YYYY-MM-DD'));
      d.setUTCHours(0, 0, 0, 0);
      const currentDateIso = d.toISOString();

      const dayOfWeek = (current.day() + 6) % 7;

      const ws = new Date(d);
      const diff = ws.getUTCDay() === 0 ? -6 : 1 - ws.getUTCDay();
      ws.setUTCDate(ws.getUTCDate() + diff);
      const weekStartIso = ws.toISOString();

      const dayId = dayIdCounter++;
      days.push({
        id: dayId,
        date: currentDateIso,
        status: 'open',
        createdBy: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      for (const shift of shifts) {
        // Vary the number of kips per day to show "Per-Day" flexibility
        const dailyKips = kips.filter((k) => k.shiftId === shift.id && k.daysOfWeek.includes(dayOfWeek));

        // Randomly skip some kips for this specific day to show it's not "y nguyên"
        const filteredKips = dailyKips.filter(() => Math.random() > 0.2);

        for (const kip of filteredKips) {
          const isPast = current.isBefore(now, 'day');
          const isToday = current.isSame(now, 'day');

          let assignedUserIds: number[] = [];
          let attendedUserIds: number[] = [];
          let status: 'open' | 'locked' = 'open';

          if (isPast || isToday) {
            const userPool = [1, 2, 3, 4, 5];
            const count = Math.floor(Math.random() * 2) + 1;
            const shuffled = [...userPool].sort(() => 0.5 - Math.random());
            assignedUserIds = shuffled.slice(0, count);

            if (isPast) {
              attendedUserIds = assignedUserIds.filter(() => Math.random() > 0.1);
              if (Math.random() > 0.4) status = 'locked';
            }
          }

          slots.push({
            id: slotIdCounter++,
            dayId,
            weekStart: new Date(weekStartIso),
            shiftDate: new Date(currentDateIso),
            kipId: kip.id,
            shiftId: shift.id,
            shiftLabel: `${shift.name} - ${kip.name}`,
            startTime: kip.startTime,
            endTime: kip.endTime,
            capacity: kip.capacity,
            order: kip.order,
            endPeriod: kip.endPeriod,
            status,
            assignedUserIds,
            attendedUserIds,
            note: Math.random() > 0.85 ? 'Ghi chú đặc biệt cho ngày này' : kip.description,
          });
        }
      }
      current = current.add(1, 'day');
    }
    await dbObj.collection('duty_days').insertMany(days);
    await dbObj.collection('duty_slots').insertMany(slots);

    // 4. Create mock Leave Requests
    console.log('Creating mock Leave Requests...');
    const leaveRequests = [
      {
        id: 1,
        slotId: 1,
        userId: 1,
        reason: 'Có việc gia đình đột xuất ngày đầu tháng',
        status: 'pending',
        createdAt: dayjs().subtract(1, 'hour').toDate(),
        updatedAt: dayjs().subtract(1, 'hour').toDate(),
      },
      {
        id: 2,
        slotId: 5,
        userId: 2,
        reason: 'Đi khám sức khỏe định kỳ',
        status: 'pending',
        createdAt: dayjs().subtract(2, 'day').toDate(),
        updatedAt: dayjs().subtract(2, 'day').toDate(),
      },
    ];
    await dbObj.collection('duty_leave_requests').insertMany(leaveRequests);

    console.log(
      `Successfully seeded ${shifts.length} shifts, ${kips.length} kips, ${slots.length} slots for entire month.`,
    );
    console.log('Seeded 2 pending leave requests.');
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedDutyData();
