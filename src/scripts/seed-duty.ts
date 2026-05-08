import dotenv from 'dotenv';
import path from 'path';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import isoWeek from 'dayjs/plugin/isoWeek';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import db, { initDatabase } from '@database/mongo-database.adapter';

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
      // Group 1 (Standard) - Monday to Friday
      {
        id: 1,
        templateId: 1,
        name: 'Ca Hành chính (Sáng)',
        startTime: '07:30',
        endTime: '11:45',
        order: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      {
        id: 2,
        templateId: 1,
        name: 'Ca Hành chính (Chiều)',
        startTime: '13:30',
        endTime: '17:45',
        order: 2,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      {
        id: 3,
        templateId: 1,
        name: 'Ca Trực Đêm (Kỹ thuật)',
        startTime: '18:00',
        endTime: '22:30',
        order: 3,
        daysOfWeek: [1, 2, 4, 5],
      },

      // Group 2 (Summer) - Adjusted times
      {
        id: 4,
        templateId: 2,
        name: 'Ca Sáng (Mùa Hè)',
        startTime: '06:30',
        endTime: '11:00',
        order: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      {
        id: 5,
        templateId: 2,
        name: 'Ca Chiều (Mùa Hè)',
        startTime: '13:30',
        endTime: '17:30',
        order: 2,
        daysOfWeek: [1, 2, 3, 4, 5],
      },

      // Group 3 (Special) - Segmented Event
      {
        id: 6,
        templateId: 3,
        name: 'Sự kiện: Hội nghị Khoa học',
        startTime: '07:30',
        endTime: '17:30',
        order: 1,
        daysOfWeek: [2, 3],
        isSpecialEvent: true,
      },
    ];
    await db.insertMany('duty_shifts', shifts);

    // 3. Create Kip Templates
    console.log('Creating Kip Templates...');
    const kips = [
      // Group 1 - Sáng (Shift 1)
      {
        id: 1,
        shiftId: 1,
        name: 'Tiếp đón & Hướng dẫn',
        startTime: '07:45',
        endTime: '09:30',
        capacity: 3,
        order: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      {
        id: 2,
        shiftId: 1,
        name: 'Xử lý hồ sơ văn phòng',
        startTime: '09:30',
        endTime: '11:15',
        capacity: 4,
        order: 2,
        daysOfWeek: [1, 2, 3, 4, 5],
      },

      // Group 1 - Chiều (Shift 2)
      {
        id: 4,
        shiftId: 2,
        name: 'Hỗ trợ kỹ thuật hệ thống',
        startTime: '13:45',
        endTime: '15:45',
        capacity: 2,
        order: 1,
        daysOfWeek: [1, 2, 3, 4, 5],
      },
      {
        id: 5,
        shiftId: 2,
        name: 'Tổng hợp báo cáo ngày',
        startTime: '15:45',
        endTime: '17:15',
        capacity: 2,
        order: 2,
        daysOfWeek: [1, 2, 3, 4, 5],
      },

      // Group 1 - Tối (Shift 3)
      {
        id: 6,
        shiftId: 3,
        name: 'Giám sát An ninh mạng',
        startTime: '18:30',
        endTime: '21:30',
        capacity: 2,
        order: 1,
        daysOfWeek: [1, 2, 4, 5],
      },

      // Group 3 - Event (Shift 6) - BREAKING DOWN THE LONG SHIFT
      {
        id: 11,
        shiftId: 6,
        name: 'Đón đại biểu (Phiên sáng)',
        startTime: '08:00',
        endTime: '10:30',
        capacity: 5,
        order: 1,
        daysOfWeek: [2, 3],
      },
      {
        id: 12,
        shiftId: 6,
        name: 'Phục vụ Hội thảo',
        startTime: '10:30',
        endTime: '12:00',
        capacity: 3,
        order: 2,
        daysOfWeek: [2, 3],
      },
      {
        id: 13,
        shiftId: 6,
        name: 'Phiên thảo luận chiều',
        startTime: '13:30',
        endTime: '15:30',
        capacity: 4,
        order: 3,
        daysOfWeek: [2, 3],
      },
      {
        id: 14,
        shiftId: 6,
        name: 'Bế mạc & Dọn dẹp',
        startTime: '15:30',
        endTime: '17:00',
        capacity: 2,
        order: 4,
        daysOfWeek: [2, 3],
      },
    ];
    await db.insertMany('duty_kips', kips);

    // 4. Create Template Assignments
    console.log('Creating Template Assignments...');
    const assignments = [
      {
        id: 1,
        templateId: 1,
        startDate: dayjs.utc().startOf('month').subtract(1, 'month').toISOString(),
        endDate: dayjs.utc().endOf('month').toISOString(),
        note: 'Kỳ học mùa đông chuẩn',
        createdBy: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 2,
        templateId: 3,
        startDate: dayjs.utc().add(10, 'day').toISOString(),
        endDate: dayjs.utc().add(15, 'day').toISOString(),
        note: 'Tuần lễ Sự kiện',
        createdBy: 1,
        createdAt: new Date().toISOString(),
      },
      {
        id: 3,
        templateId: 2,
        startDate: dayjs.utc().add(1, 'month').toISOString(),
        endDate: dayjs.utc().add(2, 'month').toISOString(),
        note: 'Kỳ học mùa hè',
        createdBy: 1,
        createdAt: new Date().toISOString(),
      },
    ];
    await db.insertMany('duty_template_assignments', assignments);

    // 5. Generate Days and Slots
    console.log('Generating Days and Slots...');
    const now = dayjs.utc();
    let current = now.startOf('isoWeek').subtract(1, 'weeks');
    const endWindow = now.endOf('isoWeek').add(3, 'weeks');

    const days = [];
    const slots = [];
    let dayIdCounter = 1;
    let slotIdCounter = 1;

    // Fetch existing users to assign valid IDs
    const users = await db.findAll('users');
    const userIds = users.length > 0 ? users.map((u) => u.id) : [1, 2, 3, 4, 5];

    while (current.isBefore(endWindow) || current.isSame(endWindow, 'day')) {
      const shiftDate = toUTCMidnight(current);
      const weekStart = toUTCMidnight(current.startOf('isoWeek'));
      const dayOfWeek = (current.day() + 6) % 7;

      const activeAssignment = assignments.find((a) => {
        const d = dayjs.utc(shiftDate);
        return d.isSameOrAfter(dayjs.utc(a.startDate), 'day') && d.isSameOrBefore(dayjs.utc(a.endDate), 'day');
      });
      const templateId = activeAssignment?.templateId || 1;
      const dailyShifts = shifts.filter((s) => s.templateId === templateId && s.daysOfWeek.includes(dayOfWeek));

      const dayId = dayIdCounter++;
      days.push({
        id: dayId,
        date: shiftDate.toISOString(),
        status: current.isBefore(now.subtract(2, 'day'), 'day') ? 'locked' : 'open',
        shiftTemplateIds: dailyShifts.map((s) => s.id),
        note: dayOfWeek === 6 ? 'Trực cuối tuần' : '',
        createdBy: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      for (const shift of dailyShifts) {
        const isPast = current.isBefore(now, 'day');
        const isToday = current.isSame(now, 'day');
        const dailyKips = kips.filter((k) => k.shiftId === shift.id && k.daysOfWeek.includes(dayOfWeek));

        // 1. Shift-level (Ca) - Only if NO kips OR randomly for short shifts (diversity)
        const shouldAddShiftSlot = dailyKips.length === 0 || (shift.id !== 6 && Math.random() > 0.8);

        if (shouldAddShiftSlot) {
          const shiftAssignedIds = Math.random() > 0.5 ? [userIds[Math.floor(Math.random() * userIds.length)]] : [];
          slots.push({
            id: slotIdCounter++,
            dayId,
            weekStart: weekStart.toISOString(),
            shiftDate: shiftDate.toISOString(),
            kipId: null,
            shiftId: shift.id,
            shiftLabel: `${shift.name} (Toàn ca)`,
            startTime: shift.startTime,
            endTime: shift.endTime,
            capacity: 1,
            order: shift.order,
            status: isPast ? 'locked' : 'open',
            isSpecialEvent: !!shift.isSpecialEvent,
            assignedUserIds: shiftAssignedIds,
            attendedUserIds: isPast ? shiftAssignedIds : [],
            createdBy: 1,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }

        // 2. Kip-level
        for (const kip of dailyKips) {
          let assignedUserIds: any[] = [];
          if (isPast || isToday || Math.random() > 0.3) {
            const count = Math.ceil(Math.random() * kip.capacity);
            assignedUserIds = [...userIds].sort(() => 0.5 - Math.random()).slice(0, count);
          }

          slots.push({
            id: slotIdCounter++,
            dayId,
            weekStart: weekStart.toISOString(),
            shiftDate: shiftDate.toISOString(),
            kipId: kip.id,
            shiftId: shift.id,
            shiftLabel: kip.name, // Use Kip name directly for cleaner look
            startTime: kip.startTime || shift.startTime,
            endTime: kip.endTime || shift.endTime,
            capacity: kip.capacity,
            order: kip.order,
            status: isPast ? 'locked' : 'open',
            isSpecialEvent: !!shift.isSpecialEvent,
            assignedUserIds,
            attendedUserIds: isPast ? assignedUserIds.filter(() => Math.random() > 0.2) : [],
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
    const futureSlots = slots.filter((s) => dayjs.utc(s.shiftDate).isAfter(now) && s.assignedUserIds.length > 0);
    if (futureSlots.length > 3) {
      const leaveRequests = [
        {
          id: 1,
          slotId: futureSlots[0].id,
          userId: futureSlots[0].assignedUserIds[0],
          reason: 'Bận lịch thi cuối kỳ đột xuất',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 2,
          slotId: futureSlots[1].id,
          userId: futureSlots[1].assignedUserIds[0],
          reason: 'Có việc gia đình ở quê',
          status: 'approved',
          approvedBy: 1,
          createdAt: dayjs().subtract(1, 'day').toISOString(),
          updatedAt: dayjs().toISOString(),
        },
      ];
      await db.insertMany('duty_leave_requests', leaveRequests);
    }

    // 7. Create mock Swap Requests
    console.log('Creating mock Swap Requests...');
    if (futureSlots.length > 5) {
      const swapRequests = [
        {
          id: 1,
          dutySlotId: futureSlots[2].id,
          requesterId: futureSlots[2].assignedUserIds[0],
          targetUserId: userIds.find((id) => id !== futureSlots[2].assignedUserIds[0]) || 2,
          reason: 'Muốn đổi sang kíp khác để đi làm thêm',
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
      await db.insertMany('duty_swap_requests', swapRequests);
    }

    console.log(`Successfully seeded Duty data across ${collections.length} collections.`);
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    process.exit(0);
  }
}

seedDutyData();
