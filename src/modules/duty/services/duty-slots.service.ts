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
} from './duty-utils';
import dutySettingsService from './duty-settings.service';
import dutyLogsService from './duty-logs.service';

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
          })),
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
    if (payload.assignedUserIds) patch.assignedUserIds = normalizeIdList(payload.assignedUserIds);

    const updated = await dutySlotsRepository.update(slotId, patch);

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
      const userTotalInWeek = allSlotsInWeek.filter((s: any) =>
        normalizeIdList(s.assignedUserIds || []).includes(userId),
      ).length;
      if (userTotalInWeek >= settings.weeklyKipLimit) {
        throw ApiError.badRequest(`Bạn đã đạt giới hạn đăng ký trong tuần (${settings.weeklyKipLimit} kíp).`);
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
    const isFull = assigned.length >= (slot.capacity || 1);

    if (!settings.allowUnregisterWhenFull && isFull && !isAdmin) {
      throw ApiError.badRequest('Kíp đã đủ người, không thể tự ý hủy. Hãy liên hệ Admin.');
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
}

export default new DutySlotsService();
