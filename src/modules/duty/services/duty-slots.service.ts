import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyDaysRepository from '@modules/duty/repositories/duty-days.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import ApiError from '@utils/api-error';
import notificationService from '@modules/notifications/services/notification.service';
import dayjs from 'dayjs';
import {
  Identifier,
  GenericRecord,
  DutyUser,
  DutySlotRecord,
  normalizeId,
  normalizeIdList,
  getActorId,
  toUTCMidnight,
  getWeekStartISO,
  getWeekEndISO,
  isTimeInShiftRange,
  isIpAllowed,
} from './duty-utils';
import dutySettingsService from './duty-settings.service';
import dutyLogsService from './duty-logs.service';
import dutyViolationsRepository from '@modules/duty/repositories/duty-violations.repository';

class DutySlotsService {
  async findSlotOrThrow(slotId: Identifier) {
    const slot = (await dutySlotsRepository.findById(slotId)) as DutySlotRecord | null;
    if (!slot) {
      throw ApiError.notFound('Duty slot not found');
    }
    return slot;
  }

  async getSlotLabel(slot: any) {
    if (slot.shiftLabel) return slot.shiftLabel;
    const kip = await dutyKipsRepository.findById(slot.kipId);
    if (!kip) return 'Kíp trực';
    const shift = await dutyShiftsRepository.findById(kip.shiftId);
    if (!shift) return kip.name;
    return `${shift.name} - ${kip.name}`;
  }

  async findOrCreateDay(date: string, actorId: Identifier) {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    const isoDate = d.toISOString();

    let dayRecord = await dutyDaysRepository.findByDate(isoDate);
    if (!dayRecord) {
      dayRecord = await dutyDaysRepository.create({
        date: isoDate,
        dayOfWeek: (new Date(isoDate).getUTCDay() + 6) % 7,
        status: 'open',
        createdBy: normalizeId(actorId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    return dayRecord;
  }

  async getWeeklySchedule(options: any = {}) {
    const weekStart = getWeekStartISO(options.weekStart);
    const weekEnd = getWeekEndISO(weekStart);

    const ws = dayjs(weekStart);
    const we = dayjs(weekEnd);

    const [days, shifts, kips, slotsResult, users, assignments] = await Promise.all([
      dutyDaysRepository.findMany({
        date_gte: ws.toISOString(),
        date_lte: we.toISOString(),
      }),
      dutyShiftsRepository.findMany({
        date_gte: ws.toDate(),
        date_lte: we.toDate(),
      }),
      dutyKipsRepository.findMany({
        date_gte: ws.toDate(),
        date_lte: we.toDate(),
      }),
      dutySlotsRepository.findAllAdvanced({
        limit: 1000,
        filter: {
          shiftDate_gte: ws.toDate(),
          shiftDate_lte: we.toDate(),
        },
      }),
      usersRepository.findAll() as Promise<DutyUser[]>,
      dutyTemplateAssignmentsRepository.findMany({
        startDate_lte: we.toISOString(),
        endDate_gte: ws.toISOString(),
      }),
    ]);

    const slotIds = slotsResult.data.map((s: any) => normalizeId(s.id));

    const [violations, leaveRequests, swapRequests] = await Promise.all([
      dutyViolationsRepository.findMany({ slotId_in: slotIds }),
      dutyLeaveRequestsRepository.findMany({ slotId_in: slotIds }),
      dutySwapRequestsRepository.findMany({ fromSlotId_in: slotIds }),
    ]);

    const userMap = new Map(users.map((user) => [normalizeId(user.id), user]));

    const slots = slotsResult.data.map((slot: any) => {
      const assignedIds = normalizeIdList(slot.assignedUserIds || []);
      const kip = kips.find((k: any) => normalizeId(k.id) === normalizeId(slot.kipId));
      const shift = shifts.find((s: any) => normalizeId(s.id) === normalizeId(slot.shiftId || kip?.shiftId));

      return {
        ...slot,
        shiftLabel: shift && kip ? `${shift.name} - ${kip.name}` : kip?.name || 'Kíp trực',
        startTime: slot.startTime || kip?.startTime || shift?.startTime,
        endTime: slot.endTime || kip?.endTime || shift?.endTime,
        assignedUsers: assignedIds
          .map((id) => userMap.get(id))
          .filter(Boolean)
          .map((user: any) => ({
            id: user.id,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            position: user.position,
          })),
        violations: violations.filter((v: any) => normalizeId(v.slotId) === normalizeId(slot.id)),
        leaveRequests: leaveRequests.filter((r: any) => normalizeId(r.slotId) === normalizeId(slot.id)),
        swapRequests: swapRequests.filter((r: any) => normalizeId(r.fromSlotId) === normalizeId(slot.id)),
      };
    });

    const templateData = shifts.map((s: any) => ({
      ...s,
      kips: kips
        .filter((k: any) => normalizeId(k.shiftId) === normalizeId(s.id))
        .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
    }));

    return {
      success: true,
      data: {
        slots,
        days,
        assignments,
        templates: templateData,
      },
      weekStart,
      weekEnd,
    };
  }

  async createActualShift(payload: GenericRecord, actorId: Identifier) {
    if (!payload.date) throw ApiError.badRequest('Ngày là bắt buộc');
    const dayRecord = await this.findOrCreateDay(payload.date, actorId);

    const created = await dutyShiftsRepository.create({
      dayId: dayRecord.id,
      date: payload.date,
      name: payload.name,
      startTime: payload.startTime,
      endTime: payload.endTime,
      status: 'open',
      createdBy: normalizeId(actorId),
      note: payload.note || '',
    });

    await dutyLogsService.log(
      'manual_update',
      'system',
      `Tạo ca trực mới: ${created.name} (${created.startTime} - ${created.endTime}).`,
      actorId,
    );

    return created;
  }

  async createActualKip(payload: GenericRecord, actorId: Identifier) {
    if (!payload.shiftId) throw ApiError.badRequest('shiftId là bắt buộc');
    const shift = await dutyShiftsRepository.findById(payload.shiftId);
    if (!shift) throw ApiError.notFound('Ca trực không tồn tại');

    if (payload.startTime && !isTimeInShiftRange(payload.startTime, shift.startTime, shift.endTime)) {
      throw ApiError.badRequest(
        `Giờ bắt đầu (${payload.startTime}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
      );
    }
    if (payload.endTime && !isTimeInShiftRange(payload.endTime, shift.startTime, shift.endTime)) {
      throw ApiError.badRequest(
        `Giờ kết thúc (${payload.endTime}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
      );
    }

    const createdKip = await dutyKipsRepository.create({
      shiftId: shift.id,
      date: shift.date,
      name: payload.name,
      coefficient: Number(payload.coefficient) || 1,
      capacity: Number(payload.capacity) || 1,
      startTime: payload.startTime || null,
      endTime: payload.endTime || null,
      slotStructure: payload.slotStructure || [],
      config: payload.config || {},
      status: 'open',
      note: payload.note || '',
    });

    await dutySlotsRepository.create({
      kipId: createdKip.id,
      shiftDate: shift.date,
      capacity: createdKip.capacity,
      status: 'open',
      createdBy: normalizeId(actorId),
    });

    await dutyLogsService.log(
      'manual_update',
      'system',
      `Tạo kíp trực mới: ${createdKip.name} thuộc ca ${shift.name}.`,
      actorId,
    );

    return createdKip;
  }

  async createSlot(payload: GenericRecord, actorId: Identifier) {
    if (!payload.kipId) throw ApiError.badRequest('kipId là bắt buộc');
    const kip = await dutyKipsRepository.findById(payload.kipId);
    if (!kip) throw ApiError.notFound('Kíp không tồn tại');

    const created = await dutySlotsRepository.create({
      kipId: kip.id,
      shiftDate: kip.date,
      capacity: payload.capacity || kip.capacity,
      assignedUserIds: normalizeIdList(payload.assignedUserIds || []),
      status: 'open',
      createdBy: normalizeId(actorId),
      note: payload.note || '',
      config: payload.config || {},
    });

    await dutyLogsService.log(
      'manual_update',
      'system',
      `Admin tạo phiên đăng ký mới cho kíp: ${kip.name}`,
      actorId,
      undefined,
      created.id,
    );

    return created;
  }

  async deleteSlot(id: Identifier, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(id);
    if (!slot) throw ApiError.notFound('Phiên không tồn tại');

    await dutyLogsService.log(
      'unassigned',
      'removed',
      `Admin xóa phiên đăng ký của ngày ${new Date(slot.shiftDate).toLocaleDateString()}`,
      performerId,
      undefined,
      id,
    );

    await dutySlotsRepository.delete(id);
    return { success: true };
  }

  async updateSlot(slotId: Identifier, payload: GenericRecord = {}, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    if (slot.kipId && (payload.startTime !== undefined || payload.endTime !== undefined)) {
      const kip = await dutyKipsRepository.findById(slot.kipId);
      const shiftId = kip?.shiftId || slot.shiftId;

      if (shiftId) {
        const shift = await dutyShiftsRepository.findById(shiftId);
        if (shift) {
          const st = payload.startTime ?? slot.startTime ?? kip?.startTime;
          const et = payload.endTime ?? slot.endTime ?? kip?.endTime;

          if (st && !isTimeInShiftRange(st, shift.startTime, shift.endTime)) {
            throw ApiError.badRequest(
              `Giờ bắt đầu (${st}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
            );
          }
          if (et && !isTimeInShiftRange(et, shift.startTime, shift.endTime)) {
            throw ApiError.badRequest(
              `Giờ kết thúc (${et}) phải nằm trong khung giờ của ca (${shift.startTime} - ${shift.endTime})`,
            );
          }
        }
      }
    }

    const patch: GenericRecord = { ...payload, updatedAt: new Date().toISOString() };
    if (payload.shiftDate) patch.shiftDate = toUTCMidnight(payload.shiftDate);

    const oldAssignedIds = normalizeIdList(slot.assignedUserIds || []).map(Number);
    if (payload.assignedUserIds) {
      const newIds = normalizeIdList(payload.assignedUserIds).map(Number);
      patch.assignedUserIds = newIds;
      // Mark these users as Admin-Assigned in config
      patch.config = {
        ...(slot.config || {}),
        ...(payload.config || {}),
        adminAssignedUserIds: newIds,
      };
    }

    const updated = await dutySlotsRepository.update(slotId, patch);
    const newAssignedIds = normalizeIdList(updated.assignedUserIds || []).map(Number);

    // Notification Logic
    const addedUsers = newAssignedIds.filter((id) => !oldAssignedIds.includes(id));
    const removedUsers = oldAssignedIds.filter((id) => !newAssignedIds.includes(id));
    const slotLabel = await this.getSlotLabel(updated);
    const dateStr = new Date(updated.shiftDate).toLocaleDateString('vi-VN');

    if (addedUsers.length > 0) {
      console.log(`[Duty] Notifying ${addedUsers.length} added users for slot ${slotId}`);
      await Promise.all(
        addedUsers.map((userId) =>
          notificationService.notifyUser(userId, {
            title: 'Thông báo phân công trực',
            message: `Admin đã phân công bạn trực kíp: ${slotLabel} ngày ${dateStr}`,
            category: 'shift',
            type: 'shift',
            refId: updated.id,
          }),
        ),
      );
    }

    if (removedUsers.length > 0) {
      await Promise.all(
        removedUsers.map((userId) =>
          notificationService.notifyUser(userId, {
            title: 'Thay đổi lịch trực',
            message: `Bạn đã được rút tên khỏi kíp: ${slotLabel} ngày ${dateStr}`,
            category: 'shift',
            type: 'shift',
            refId: updated.id,
          }),
        ),
      );
    }

    if (slot.kipId) {
      const kipUpdate: GenericRecord = { updatedAt: new Date().toISOString() };
      let changed = false;
      if (payload.capacity !== undefined) {
        kipUpdate.capacity = Number(payload.capacity);
        changed = true;
      }
      if (payload.startTime !== undefined) {
        kipUpdate.startTime = payload.startTime;
        changed = true;
      }
      if (payload.endTime !== undefined) {
        kipUpdate.endTime = payload.endTime;
        changed = true;
      }
      if (changed) await dutyKipsRepository.update(slot.kipId, kipUpdate);
    }

    const label = await this.getSlotLabel(slot);
    await dutyLogsService.log(
      'manual_update',
      'system',
      `Admin cập nhật thông tin kíp trực: ${label}`,
      performerId,
      undefined,
      slotId,
    );

    return updated;
  }

  async registerToSlot(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');
    if (slot.status === 'locked') throw ApiError.badRequest('Locked');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (assigned.some((id) => String(id) === String(userId))) return slot;

    const sameDateSlots = await dutySlotsRepository.findMany({ shiftDate: slot.shiftDate });
    const hasConflict = sameDateSlots.some((item: any) => {
      if (normalizeId(item.id) === normalizeId(slot.id)) return false;
      const itemAssigned = normalizeIdList(item.assignedUserIds || []);
      if (!itemAssigned.includes(userId)) return false;
      return (item.startTime || '') === (slot.startTime || '') && (item.endTime || '') === (slot.endTime || '');
    });

    if (hasConflict) throw ApiError.badRequest('Bạn đã có lịch trực khác vào thời gian này.');

    const settings = await dutySettingsService.getSettings();
    const weeklyLimit = settings.weeklyKipLimit;
    if (weeklyLimit && Number(weeklyLimit) > 0) {
      const allSlotsInWeek = await dutySlotsRepository.findMany({ weekStart: new Date(slot.weekStart).toISOString() });
      const userSlotsInWeek = allSlotsInWeek.filter((s: any) =>
        normalizeIdList(s.assignedUserIds || []).includes(userId),
      );

      // Fetch kips for these slots to get coefficients
      const userKipIds = userSlotsInWeek.map((s: any) => s.kipId).filter(Boolean);
      const userKips = await dutyKipsRepository.findMany({ id_in: userKipIds });

      // Add the current kip to the calculation
      const currentKip = await dutyKipsRepository.findById(slot.kipId);

      const totalCoefficient =
        userKips.reduce((acc: number, k: any) => acc + (Number(k.coefficient) || 1), 0) +
        (Number(currentKip?.coefficient) || 1);

      if (totalCoefficient > Number(settings.weeklyKipLimit)) {
        throw ApiError.badRequest(
          `Bạn đã đạt giới hạn đăng ký trong tuần (${settings.weeklyKipLimit} kíp). Hiện tại: ${totalCoefficient - (Number(currentKip?.coefficient) || 1)} kíp. kíp này tính ${currentKip?.coefficient} kíp.`,
        );
      }
    }

    let maxCapacity = Number(slot.capacity);
    if (!maxCapacity || isNaN(maxCapacity)) {
      const kip = await dutyKipsRepository.findById(slot.kipId);
      maxCapacity = Number(kip?.capacity) || 1;
    }

    if (assigned.length >= maxCapacity) throw ApiError.badRequest('Ca trực đã đầy, vui lòng chọn kíp khác.');

    const slotStructure = slot.slotStructure || [];
    if (slotStructure.length > 0) {
      const fullUser = typeof user === 'object' ? user : await usersRepository.findById(userId);
      const userPosition = fullUser?.position;
      const requirement = slotStructure.find(
        (req: any) => Array.isArray(req.positions) && req.positions.includes(userPosition),
      );

      if (requirement) {
        const assignedUsers = await usersRepository.findMany({ id_in: assigned });
        const occupantsInGroup = assignedUsers.filter(
          (u: any) => Array.isArray(requirement.positions) && requirement.positions.includes(u.position),
        ).length;
        if (occupantsInGroup >= requirement.slots)
          throw ApiError.badRequest(`Hết chỗ cho vị trí '${requirement.label}' (${requirement.slots} slot).`);
      } else {
        const totalStructuredSlots = slotStructure.reduce((acc: number, req: any) => acc + (Number(req.slots) || 0), 0);
        const freeSlotsTotal = maxCapacity - totalStructuredSlots;
        const assignedUsers = await usersRepository.findMany({ id_in: assigned });
        const structuredUserIds = new Set();
        slotStructure.forEach((req: any) => {
          assignedUsers.forEach((u: any) => {
            if (Array.isArray(req.positions) && req.positions.includes(u.position)) structuredUserIds.add(u.id);
          });
        });
        const unmappedOccupants = assigned.length - structuredUserIds.size;
        if (unmappedOccupants >= freeSlotsTotal && freeSlotsTotal >= 0) {
          throw ApiError.badRequest(
            'Hết chỗ cho vị trí của bạn (Các chỗ còn lại đã được dành riêng cho chức vụ khác).',
          );
        }
      }
    }

    const updated = await dutySlotsRepository.update(slot.id, {
      assignedUserIds: [...assigned, userId].map(Number),
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Đăng ký kíp trực thành công',
      message: `Bạn đã đăng ký: ${slot.shiftLabel} ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}`,
      category: 'shift',
      type: 'shift',
      refId: slot.id,
    });

    await dutyLogsService.log(
      'manual_update',
      'assign',
      `Đăng ký kíp trực: ${slot.shiftLabel}.`,
      userId,
      userId,
      slot.id,
    );

    return updated;
  }

  async cancelRegistration(slotId: Identifier, user: GenericRecord | Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp trực không tồn tại');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (!assigned.includes(userId)) throw ApiError.badRequest('Bạn không đăng ký kíp trực này');

    const settings = await dutySettingsService.getSettings();
    const isAdmin = typeof user === 'object' && (user as any).role === 'admin';
    const isStaff = typeof user === 'object' && (user as any).role === 'staff';
    const isFull = assigned.length >= (slot.capacity || 1);

    if (slot.status === 'locked' && !isAdmin && !isStaff) {
      throw ApiError.badRequest('Kíp trực đã bị khóa, không thể tự ý hủy. Hãy liên hệ Admin.');
    }

    if (!settings.allowUnregisterWhenFull && isFull && !isAdmin && !isStaff) {
      throw ApiError.badRequest('Kíp đã đủ người, không thể tự ý hủy theo quy định. Hãy liên hệ Admin.');
    }

    const updated = await dutySlotsRepository.update(slot.id, {
      assignedUserIds: assigned.filter((id) => id !== userId),
      updatedAt: new Date().toISOString(),
    });

    await dutyLogsService.log(
      'manual_update',
      'cancel',
      `Hủy đăng ký kíp: ${slot.shiftLabel}.`,
      userId,
      userId,
      slotId,
    );

    return updated;
  }

  async markAttendance(slotId: Identifier, userIds: Identifier[], performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const updated = await dutySlotsRepository.update(slotId, { attendedUserIds: userIds });
    const label = await this.getSlotLabel(slot);
    await dutyLogsService.log(
      'manual_update',
      'system',
      `Điểm danh cho kíp: ${label}. Danh sách người có mặt: ${userIds.join(', ')}`,
      performerId,
      undefined,
      slotId,
    );

    return updated;
  }

  async selfCheckIn(slotId: Identifier, user: any, ip: string) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp trực không tồn tại');

    const userId = getActorId(user);
    const now = dayjs();
    const slotDateStr = dayjs(slot.shiftDate).format('YYYY-MM-DD');
    const startTime = slot.startTime || '00:00';
    const slotStart = dayjs(`${slotDateStr} ${startTime}`);

    // 1. Check IP
    const settings = await dutySettingsService.getSettings();
    if (settings.allowedIpRanges && !isIpAllowed(ip, settings.allowedIpRanges)) {
      throw ApiError.badRequest(`Địa chỉ mạng (${ip}) không hợp lệ để điểm danh tại văn phòng.`);
    }

    // 2. Check Timing (+/- 1 minute)
    const windowStart = slotStart.subtract(1, 'minute');
    const windowEnd = slotStart.add(1, 'minute');

    if (now.isBefore(windowStart)) {
      throw ApiError.badRequest(`Chưa đến giờ điểm danh. Vui lòng quay lại vào lúc ${windowStart.format('HH:mm')}`);
    }
    if (now.isAfter(windowEnd)) {
      throw ApiError.badRequest('Đã quá thời gian tự điểm danh (+/- 1 phút). Vui lòng báo cáo Quản lý kíp.');
    }

    // 3. Mark Attendance
    const attended = normalizeIdList(slot.attendedUserIds || []);
    if (!attended.includes(userId)) {
      attended.push(userId);
    }

    const attendanceData = slot.attendanceData || {};
    attendanceData[userId] = {
      time: now.toISOString(),
      ip,
      method: 'self',
    };

    const update: any = {
      attendedUserIds: attended,
      attendanceData,
      updatedAt: now.toISOString(),
    };

    // 4. Leadership Management (Manager = Quản lý kíp)
    const assignedIds = normalizeIdList(slot.assignedUserIds || []);
    const originalManagerId = assignedIds[0];

    // If the original manager checks in now (within the 2-min window), they are the manager
    if (normalizeId(userId) === normalizeId(originalManagerId)) {
      update.tempLeaderId = null; // Original manager is present, clear any temp leader
    } else if (!slot.tempLeaderId) {
      // Someone else checked in first, and original manager is not here yet
      const originalManagerAttended = attended.includes(normalizeId(originalManagerId));
      if (!originalManagerAttended) {
        update.tempLeaderId = userId;

        await dutyLogsService.log(
          'leadership_change',
          'system',
          `Thành viên ${user.name || userId} tạm giữ quyền Quản lý kíp do Quản lý kíp gốc chưa điểm danh.`,
          userId,
          undefined,
          slotId,
        );
      }
    }

    const updated = await dutySlotsRepository.update(slotId, update);

    await dutyLogsService.log(
      'attendance',
      'self',
      `Thành viên tự điểm danh thành công tại IP: ${ip}`,
      userId,
      userId,
      slotId,
    );

    return updated;
  }

  async leaderMarkAttendance(slotId: Identifier, targetUserId: Identifier, performer: any) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp không tồn tại');

    const performerId = getActorId(performer);
    const assignedIds = normalizeIdList(slot.assignedUserIds || []);
    const originalLeaderId = assignedIds[0];
    const attendedIds = normalizeIdList(slot.attendedUserIds || []);

    // Authorization check
    const isOriginalLeader =
      normalizeId(performerId) === normalizeId(originalLeaderId) && attendedIds.includes(performerId);
    const isTempLeader = normalizeId(performerId) === normalizeId(slot.tempLeaderId);
    const isAdmin = performer.role === 'admin' || performer.role === 'staff';

    if (!isOriginalLeader && !isTempLeader && !isAdmin) {
      throw ApiError.forbidden('Bạn không có quyền điểm danh cho người khác trong kíp này.');
    }

    // Update attendance
    const targetId = normalizeId(targetUserId);
    if (!attendedIds.includes(targetId)) {
      attendedIds.push(targetId);
    }

    const attendanceData = slot.attendanceData || {};
    attendanceData[targetId] = {
      time: new Date().toISOString(),
      method: 'leader',
      markedBy: performerId,
    };

    const updated = await dutySlotsRepository.update(slotId, {
      attendedUserIds: attendedIds,
      attendanceData,
      updatedAt: new Date().toISOString(),
    });

    await dutyLogsService.log(
      'attendance',
      'leader',
      `Quản lý kíp điểm danh cho thành viên: ${targetId}`,
      performerId,
      targetId,
      slotId,
    );

    return updated;
  }

  async reportViolation(payload: any, performer: any) {
    const { slotId, userId, type, coefficient, note } = payload;
    const performerId = getActorId(performer);

    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp không tồn tại');

    // Reuse same authorization as attendance
    const assignedIds = normalizeIdList(slot.assignedUserIds || []);
    const originalLeaderId = assignedIds[0];
    const attendedIds = normalizeIdList(slot.attendedUserIds || []);

    const isOriginalLeader =
      normalizeId(performerId) === normalizeId(originalLeaderId) && attendedIds.includes(performerId);
    const isTempLeader = normalizeId(performerId) === normalizeId(slot.tempLeaderId);
    const isAdmin = performer.role === 'admin' || performer.role === 'staff';

    if (!isOriginalLeader && !isTempLeader && !isAdmin) {
      throw ApiError.forbidden('Bạn không có quyền ghi nhận vi phạm cho kíp này.');
    }

    const existingViolation = await dutyViolationsRepository.findOne({
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
    });

    let violation;
    if (existingViolation) {
      violation = await dutyViolationsRepository.update(existingViolation.id, {
        type,
        coefficient: Number(coefficient) || 1,
        note: note || '',
        updatedAt: new Date().toISOString(),
      });
    } else {
      violation = await dutyViolationsRepository.create({
        slotId: normalizeId(slotId),
        userId: normalizeId(userId),
        type,
        coefficient: Number(coefficient) || 1,
        note: note || '',
        createdBy: performerId,
        createdAt: new Date().toISOString(),
      });
    }

    await dutyLogsService.log(
      'violation',
      'report',
      `Ghi nhận vi phạm [${type}] cho thành viên: ${userId}. Hệ số: ${coefficient}`,
      performerId,
      userId,
      slotId,
    );

    return violation;
  }

  async updateActualShift(shiftId: number, data: GenericRecord) {
    const shift = await dutyShiftsRepository.findById(shiftId);
    if (!shift) throw ApiError.notFound('Ca thực tế không tồn tại');
    return await dutyShiftsRepository.update(shiftId, { ...data, updatedAt: new Date().toISOString() });
  }

  async deleteActualKip(kipId: number) {
    const kip = await dutyKipsRepository.findById(kipId);
    if (!kip) throw ApiError.notFound('Kíp thực tế không tồn tại');

    const slots = await dutySlotsRepository.findMany({ kipId: kip.id });
    const slotIds = slots.map((s) => s.id);

    if (slotIds.length > 0) {
      await Promise.all([
        dutySwapRequestsRepository.deleteMany({ dutySlotId: { $in: slotIds } }),
        dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: slotIds } }),
        dutySlotsRepository.deleteMany({ kipId: kip.id }),
      ]);
    }

    await dutyKipsRepository.delete(kip.id);
    return { success: true };
  }

  async getStats() {
    const [slots, leaves, swaps] = await Promise.all([
      dutySlotsRepository.findAll(),
      dutyLeaveRequestsRepository.findAll(),
      dutySwapRequestsRepository.findAll(),
    ]);

    return {
      global: {
        total: slots.length,
        open: slots.filter((s: any) => s.status === 'open').length,
        locked: slots.filter((s: any) => s.status === 'locked').length,
        totalAssigned: slots.reduce((acc: number, s: any) => acc + (s.assignedUserIds?.length || 0), 0),
      },
      requests: {
        leavePending: leaves.filter((r: any) => r.status === 'pending').length,
        leaveApproved: leaves.filter((r: any) => r.status === 'approved').length,
        leaveRejected: leaves.filter((r: any) => r.status === 'rejected').length,
        swapPending: swaps.filter((r: any) => r.status === 'pending').length,
        swapApproved: swaps.filter((r: any) => r.status === 'approved').length,
      },
    };
  }

  async getUserStats(userId: Identifier) {
    const id = normalizeId(userId);
    const [slots, leaves, swaps] = await Promise.all([
      dutySlotsRepository.findMany({ assignedUserIds_contains: id }),
      dutyLeaveRequestsRepository.findMany({ userId: id }),
      dutySwapRequestsRepository.findMany({ requesterId: id }),
    ]);

    // Calculate total hours from attended slots
    // We need to fetch kips for duration info
    const kipIds = normalizeIdList(slots.map((s: any) => s.kipId).filter(Boolean));
    const kips = await dutyKipsRepository.findMany({ id_in: kipIds });
    const kipMap = new Map(kips.map((k: any) => [normalizeId(k.id), k]));

    let totalMinutes = 0;
    let attendedCount = 0;
    let points = 0;

    slots.forEach((slot: any) => {
      const isAttended = normalizeIdList(slot.attendedUserIds || []).includes(id);
      if (isAttended) {
        attendedCount++;
        const kip = kipMap.get(normalizeId(slot.kipId));
        if (kip) {
          const startTime = slot.startTime || kip.startTime;
          const endTime = slot.endTime || kip.endTime;
          if (startTime && endTime) {
            const [sh, sm] = startTime.split(':').map(Number);
            const [eh, em] = endTime.split(':').map(Number);
            let diff = eh * 60 + em - (sh * 60 + sm);
            if (diff < 0) diff += 24 * 60;
            totalMinutes += diff;
          }
          points += (kip.coefficient || 1) * 10; // Basic point formula
        }
      }
    });

    return {
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      attendedCount,
      points,
      pendingRequests:
        leaves.filter((r: any) => r.status === 'pending').length +
        swaps.filter((r: any) => r.status === 'pending').length,
      upcomingCount: slots.filter((s: any) => dayjs(s.shiftDate).isAfter(dayjs())).length,
      recentLogs: await dutyLogsService.getUserLogs(id, 5),
    };
  }
}

export default new DutySlotsService();
