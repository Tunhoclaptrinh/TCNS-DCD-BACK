import dotenv from 'dotenv';
import path from 'path';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import db, { initDatabase } from '../config/database';

dayjs.extend(utc);
dayjs.extend(isoWeek);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dotenv.config({ path: path.join(process.cwd(), '.env') });

function toUTCMidnight(dateInput: any): Date {
  const dStr = dayjs(dateInput).format('YYYY-MM-DD');
  return dayjs.utc(dStr).toDate();
}

async function seedDutyData() {
  try {
    console.log('Initializing Database...');
    await initDatabase();
    console.log('Database initialized successfully.');

    // 0. Clear existing data
    const collections = [
      'duty_templates',
      'duty_shifts',
      'duty_kips',
      'duty_slots',
      'duty_leave_requests',
      'duty_swap_requests',
      'duty_days',
      'duty_template_assignments',
    ];
    for (const colName of collections) {
      console.log(`Clearing collection: ${colName}...`);
      const deleted = await db.deleteMany(colName, {});
      console.log(`  Deleted ${deleted} records from ${colName}.`);
    }

    // 1. Create Template Groups
    console.log('Creating Template Groups...');
    const templateGroups = [
      {
        id: 1,
        name: 'Bản mẫu Tiêu chuẩn (Mùa Đông)',
        isDefault: true,
        description: 'Khung giờ tiêu chuẩn áp dụng cho kỳ học mùa đông',
      },
      { id: 2, name: 'Bản mẫu Mùa Hè', isDefault: false, description: 'Khung giờ đẩy sớm 30p để tránh nắng' },
      {
        id: 3,
        name: 'Bản mẫu Sự kiện / Lễ hội',
        isDefault: false,
        description: 'Tăng cường nhân sự và thêm kíp trực đêm',
      },
    ];
    await db.insertMany('duty_templates', templateGroups);

    // 2. Create Shift Templates
    console.log('Creating Shift Templates...');
    const shifts = [
      // Group 1 (Standard)
      {
        id: 1,
        templateId: 1,
        name: 'Ca Sáng',
        startTime: '06:30',
        endTime: '11:00',
        order: 1,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: 2,
        templateId: 1,
        name: 'Ca Chiều',
        startTime: '13:00',
        endTime: '17:30',
        order: 2,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: 3,
        templateId: 1,
        name: 'Ca Tối',
        startTime: '18:30',
        endTime: '22:30',
        order: 3,
        daysOfWeek: [0, 1, 2, 4, 5, 6],
      }, // No Tối on Thursday

      // Group 2 (Summer)
      {
        id: 4,
        templateId: 2,
        name: 'Ca Sáng (Hè)',
        startTime: '06:00',
        endTime: '10:30',
        order: 1,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: 5,
        templateId: 2,
        name: 'Ca Chiều (Hè)',
        startTime: '13:30',
        endTime: '18:00',
        order: 2,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },

      // Group 3 (Special)
      {
        id: 6,
        templateId: 3,
        name: 'Ca Sáng (Tăng cường)',
        startTime: '06:30',
        endTime: '11:30',
        order: 1,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: 7,
        templateId: 3,
        name: 'Ca Đêm (Sự kiện)',
        startTime: '23:00',
        endTime: '05:00',
        order: 4,
        daysOfWeek: [5, 6],
      },
    ];
    await db.insertMany('duty_shifts', shifts);

    // 3. Create Kip Templates
    console.log('Creating Kip Templates...');
    const kips = [
      // Standard Sáng (Shift 1)
      {
        id: 1,
        shiftId: 1,
        name: 'Kíp 1 (Đầu ca)',
        startTime: '07:00',
        endTime: '09:00',
        capacity: 3,
        order: 1,
        daysOfWeek: [0, 1, 2, 3, 4],
      },
      {
        id: 2,
        shiftId: 1,
        name: 'Kíp 2 (Cuối ca)',
        startTime: '09:00',
        endTime: '11:00',
        capacity: 3,
        order: 2,
        daysOfWeek: [0, 1, 2, 3, 4],
      },
      {
        id: 3,
        shiftId: 1,
        name: 'Kíp Phụ (Cuối tuần)',
        startTime: '08:00',
        endTime: '10:00',
        capacity: 2,
        order: 1,
        daysOfWeek: [5, 6],
      },

      // Standard Chiều (Shift 2)
      {
        id: 4,
        shiftId: 2,
        name: 'Kíp 3 (Duy nhất)',
        startTime: '14:00',
        endTime: '17:00',
        capacity: 5,
        order: 1,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },

      // Standard Tối (Shift 3)
      {
        id: 5,
        shiftId: 3,
        name: 'Kíp 4 (Sớm)',
        startTime: '19:00',
        endTime: '20:30',
        capacity: 2,
        order: 1,
        daysOfWeek: [0, 1, 2, 4, 5, 6],
      },
      {
        id: 6,
        shiftId: 3,
        name: 'Kíp 5 (Muộn)',
        startTime: '20:30',
        endTime: '22:00',
        capacity: 2,
        order: 2,
        daysOfWeek: [0, 1, 2, 4, 5, 6],
      },

      // Summer Sáng (Shift 4)
      {
        id: 7,
        shiftId: 4,
        name: 'Kíp Hè 1',
        startTime: '06:30',
        endTime: '08:30',
        capacity: 4,
        order: 1,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },
      {
        id: 8,
        shiftId: 4,
        name: 'Kíp Hè 2',
        startTime: '08:30',
        endTime: '10:00',
        capacity: 4,
        order: 2,
        daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      },

      // Special Đêm (Shift 7)
      {
        id: 9,
        shiftId: 7,
        name: 'Trực Đêm 1',
        startTime: '23:30',
        endTime: '02:00',
        capacity: 1,
        order: 1,
        daysOfWeek: [5, 6],
      },
      {
        id: 10,
        shiftId: 7,
        name: 'Trực Đêm 2',
        startTime: '02:00',
        endTime: '04:30',
        capacity: 1,
        order: 2,
        daysOfWeek: [5, 6],
      },
    ];
    await db.insertMany('duty_kips', kips);

    // 4. Create Template Assignments
    console.log('Creating Template Assignments...');
    const assignments = [
      {
        id: 1,
        templateId: 1,
        startDate: dayjs.utc().startOf('month').subtract(1, 'month').toDate(),
        endDate: dayjs.utc().endOf('month').toDate(),
        note: 'Kỳ học mùa đông chuẩn',
        createdBy: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        templateId: 3,
        startDate: dayjs.utc().add(10, 'day').toDate(),
        endDate: dayjs.utc().add(15, 'day').toDate(),
        note: 'Tuần lễ Sự kiện',
        createdBy: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        templateId: 2,
        startDate: dayjs.utc().add(1, 'month').toDate(),
        endDate: dayjs.utc().add(2, 'month').toDate(),
        note: 'Kỳ học mùa hè',
        createdBy: 1,
        createdAt: new Date().toISOString(),
      },
    ];
    await db.insertMany('duty_template_assignments', assignments);

    // 5. Generate Days and Slots
    console.log('Generating Days and Slots...');
    const now = dayjs.utc();
    let current = now.startOf('isoWeek').subtract(2, 'weeks');
    const endWindow = now.endOf('isoWeek').add(4, 'weeks');

    const days = [];
    const slots = [];
    let dayIdCounter = 1;
    let slotIdCounter = 1;

    while (current.isBefore(endWindow) || current.isSame(endWindow, 'day')) {
      const shiftDate = toUTCMidnight(current);
      const weekStart = toUTCMidnight(current.startOf('isoWeek'));
      const dayOfWeek = (current.day() + 6) % 7;

      // Determine template based on assignment
      const activeAssignment = assignments.find((a) => {
        const d = dayjs.utc(shiftDate);
        return d.isSameOrAfter(dayjs.utc(a.startDate), 'day') && d.isSameOrBefore(dayjs.utc(a.endDate), 'day');
      });
      const templateId = activeAssignment?.templateId || 1;
      const dailyShifts = shifts.filter((s) => s.templateId === templateId && s.daysOfWeek.includes(dayOfWeek));

      const dayId = dayIdCounter++;
      days.push({
        id: dayId,
        date: shiftDate,
        status: current.isBefore(now.subtract(3, 'day'), 'day') ? 'locked' : 'open',
        shiftTemplateIds: dailyShifts.map((s) => s.id),
        note:
          dayOfWeek === 6 ? 'Ngày nghỉ cuối tuần' : current.isSame(now.add(12, 'day'), 'day') ? 'Khai mạc sự kiện' : '',
        createdBy: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      for (const shift of dailyShifts) {
        // Shift-level slot (Ca)
        const shiftSlotId = slotIdCounter++;
        const isPast = current.isBefore(now, 'day');
        const isToday = current.isSame(now, 'day');

        // Random assignment for shift itself sometimes
        let shiftAssignedIds: number[] = [];
        if (Math.random() > 0.9) shiftAssignedIds = [1];

        slots.push({
          id: shiftSlotId,
          dayId,
          weekStart,
          shiftDate,
          kipId: null,
          shiftId: shift.id,
          shiftLabel: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
          capacity: 2,
          order: shift.order,
          status: isPast ? 'locked' : 'open',
          assignedUserIds: shiftAssignedIds,
          attendedUserIds: isPast ? shiftAssignedIds : [],
          createdBy: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        // Kip-level slots
        const dailyKips = kips.filter((k) => k.shiftId === shift.id && k.daysOfWeek.includes(dayOfWeek));
        for (const kip of dailyKips) {
          let assignedUserIds: number[] = [];

          // Diverse occupancy logic
          const rand = Math.random();
          if (isPast || isToday) {
            const count = Math.min(kip.capacity, Math.floor(Math.random() * (kip.capacity + 1)));
            assignedUserIds = [1, 2, 3, 4, 5].sort(() => 0.5 - Math.random()).slice(0, count);
          } else if (rand > 0.3) {
            // 70% chance of some registration in future
            const count = Math.max(1, Math.floor(Math.random() * kip.capacity));
            assignedUserIds = [1, 2, 3, 4, 5].sort(() => 0.5 - Math.random()).slice(0, count);
          }

          slots.push({
            id: slotIdCounter++,
            dayId,
            weekStart,
            shiftDate,
            kipId: kip.id,
            shiftId: shift.id,
            shiftLabel: `${shift.name} - ${kip.name}`,
            startTime: kip.startTime || shift.startTime,
            endTime: kip.endTime || shift.endTime,
            capacity: kip.capacity,
            order: kip.order,
            status: isPast ? 'locked' : 'open',
            assignedUserIds,
            attendedUserIds: isPast ? assignedUserIds.filter(() => Math.random() > 0.1) : [],
            createdBy: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
      current = current.add(1, 'day');
    }

    await db.insertMany('duty_days', days);
    await db.insertMany('duty_slots', slots);

    // 6. Create mock Leave Requests
    console.log('Creating mock Leave Requests...');
    const futureKipSlots = slots.filter(
      (s) => s.kipId !== null && dayjs.utc(s.shiftDate).isAfter(now) && s.assignedUserIds.length > 0,
    );
    const leaveRequests = [
      {
        id: 1,
        slotId: futureKipSlots[0]?.id || 1,
        userId: futureKipSlots[0]?.assignedUserIds[0] || 1,
        reason: 'Có việc gia đình đột xuất',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 2,
        slotId: futureKipSlots[1]?.id || 2,
        userId: futureKipSlots[1]?.assignedUserIds[0] || 2,
        reason: 'Đi khám sức khỏe định kỳ',
        status: 'approved',
        approvedBy: 1,
        createdAt: dayjs().subtract(1, 'day').toISOString(),
        updatedAt: dayjs().toISOString(),
      },
      {
        id: 3,
        slotId: futureKipSlots[2]?.id || 3,
        userId: futureKipSlots[2]?.assignedUserIds[0] || 3,
        reason: 'Trùng lịch thi học phần',
        status: 'rejected',
        decisionNote: 'Nhân sự trực đang thiếu, vui lòng tự đổi ca',
        approvedBy: 1,
        createdAt: dayjs().subtract(2, 'day').toISOString(),
        updatedAt: dayjs().subtract(1, 'day').toISOString(),
      },
    ];
    await db.insertMany('duty_leave_requests', leaveRequests);

    // 7. Create mock Swap Requests
    console.log('Creating mock Swap Requests...');
    const swapRequests = [
      {
        id: 1,
        dutySlotId: futureKipSlots[3]?.id || 4,
        requesterId: 1,
        targetUserId: 2,
        reason: 'Muốn đổi sang kíp muộn hơn để giải quyết việc cá nhân',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: 2,
        dutySlotId: futureKipSlots[4]?.id || 5,
        requesterId: 3,
        targetUserId: 1,
        reason: 'Bận lịch học bổ sung bất ngờ',
        status: 'approved',
        approvedBy: 1,
        approvedAt: new Date().toISOString(),
        createdAt: dayjs().subtract(2, 'days').toISOString(),
        updatedAt: dayjs().subtract(1, 'day').toISOString(),
      },
      {
        id: 3,
        dutySlotId: futureKipSlots[5]?.id || 6,
        requesterId: 2,
        targetUserId: 4,
        reason: 'Đổi kíp để trực cùng nhóm bạn',
        status: 'cancelled',
        createdAt: dayjs().subtract(1, 'days').toISOString(),
        updatedAt: dayjs().toISOString(),
      },
    ];
    await db.insertMany('duty_swap_requests', swapRequests);

    console.log(`Successfully seeded Duty data across ${collections.length} collections.`);
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    process.exit(0);
  }
}

seedDutyData();
