import BaseService from '@shared/common/base-service';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import dutyLogsRepository from '@modules/duty/repositories/duty-logs.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import ApiError from '@utils/api-error';
import dayjs from 'dayjs';
import {
  Identifier,
  GenericRecord,
  normalizeId,
  normalizeIdList,
  getActorId,
  toUTCMidnight,
  getWeekStartISO,
  getWeekEndISO,
} from './duty-utils';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import { socketService } from '../../../services/socket.service';
import dutySettingService from './duty-settings.service';
import dutyTemplatesService from './duty-templates.service';

class DutySlotsService extends BaseService {
  constructor() {
    super('duty_slots', dutySlotsRepository);
  }

  async getWeeklySchedule(options: GenericRecord = {}) {
    const weekStart = getWeekStartISO(options.weekStart || options.date);
    const weekEnd = getWeekEndISO(weekStart);

    const slots = await dutySlotsRepository.findMany({
      weekStart: weekStart,
    });

    const shifts = await dutyShiftsRepository.findMany({
      shiftDate: { $gte: weekStart, $lte: weekEnd },
      isTemplate: false,
    });

    return {
      weekStart,
      weekEnd,
      shifts,
      slots,
    };
  }

  async getSlotLabel(slot: any) {
    if (slot.shiftLabel) return slot.shiftLabel;
    const shift = await dutyShiftsRepository.findById(slot.shiftId);
    const kip = await dutyKipsRepository.findById(slot.kipId);
    return `${shift?.name || 'Ca'} - ${kip?.name || 'Kíp'}`;
  }

  async createSlot(data: GenericRecord, performerId: Identifier) {
    const slot = await dutySlotsRepository.create({
      ...data,
      status: data.status || 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const label = await this.getSlotLabel(slot);
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slot.id),
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin tạo mới kíp trực thủ công: ${label}`,
      createdAt: new Date(),
    });

    return slot;
  }

  async createActualShift(data: GenericRecord, performerId: Identifier) {
    const shift = await dutyShiftsRepository.create({
      ...data,
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin tạo mới ca trực thực tế: ${shift.name}`,
      createdAt: new Date(),
    });

    return shift;
  }

  async createActualKip(data: GenericRecord, performerId: Identifier) {
    const kip = await dutyKipsRepository.create({
      ...data,
      isTemplate: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin tạo mới kíp trực thực tế: ${kip.name}`,
      createdAt: new Date(),
    });

    return kip;
  }

  async updateSlot(slotId: Identifier, data: GenericRecord, performerId: Identifier) {
    const old = await dutySlotsRepository.findById(slotId);
    if (!old) throw ApiError.notFound('Slot not found');

    const updated = await dutySlotsRepository.update(slotId, {
      ...data,
      updatedAt: new Date(),
    });

    const label = await this.getSlotLabel(updated);
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin cập nhật thông tin kíp trực: ${label}`,
      createdAt: new Date(),
    });

    return updated;
  }

  async deleteSlot(slotId: Identifier, performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const label = await this.getSlotLabel(slot);
    await dutySlotsRepository.delete(slotId);

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin xóa kíp trực: ${label}`,
      createdAt: new Date(),
    });

    return { success: true };
  }

  async registerToSlot(slotId: Identifier, user: any) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');
    if (slot.status === 'locked') throw ApiError.badRequest('Locked');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (assigned.some((id) => String(id) === String(userId))) {
      return slot;
    }

    const sameDateSlots = await dutySlotsRepository.findMany({ shiftDate: slot.shiftDate });
    const hasConflict = sameDateSlots.some((item: any) => {
      if (normalizeId(item.id) === normalizeId(slot.id)) return false;
      const itemAssigned = normalizeIdList(item.assignedUserIds || []);
      if (!itemAssigned.includes(userId)) return false;
      return (item.startTime || '') === (slot.startTime || '') && (item.endTime || '') === (slot.endTime || '');
    });

    if (hasConflict) {
      throw ApiError.badRequest('Bạn đã có lịch trực khác vào thời gian này.');
    }

    const settings = await dutySettingService.getSettings();
    const weeklyLimit = settings.weeklyKipLimit;
    if (weeklyLimit !== null && weeklyLimit !== undefined && Number(weeklyLimit) > 0) {
      const allSlotsInWeek = await dutySlotsRepository.findMany({
        weekStart: slot.weekStart,
      });

      const userTotalInWeek = allSlotsInWeek.filter((s: any) => {
        const ids = normalizeIdList(s.assignedUserIds || []);
        return ids.includes(userId);
      }).length;

      if (userTotalInWeek >= settings.weeklyKipLimit) {
        throw ApiError.badRequest(`Bạn đã đạt giới hạn đăng ký trong tuần (${settings.weeklyKipLimit} kíp).`);
      }
    }

    const currentSlot = await dutySlotsRepository.findById(slot.id);
    const currentAssigned = normalizeIdList(currentSlot.assignedUserIds || []);

    let maxCapacity = Number(currentSlot.capacity);
    if (!maxCapacity || isNaN(maxCapacity)) {
      const kip = await dutyKipsRepository.findById(currentSlot.kipId);
      maxCapacity = Number(kip?.capacity) || 1;
    }

    if (currentAssigned.length >= maxCapacity) {
      throw ApiError.badRequest('Ca trực đã đầy, vui lòng chọn kíp khác.');
    }

    const updated = await dutySlotsRepository.update(currentSlot.id, {
      assignedUserIds: [...currentAssigned, userId].map(Number),
      updatedAt: new Date().toISOString(),
    });

    await notificationService.notifyUser(userId, {
      title: 'Đăng ký kíp trực thành công',
      message: `Bạn đã đăng ký: ${slot.shiftLabel} ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}`,
      category: 'shift',
      type: 'shift',
      refId: slot.id,
    });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'assign',
      slotId: normalizeId(slot.id),
      userId: normalizeId(userId),
      performerId: normalizeId(userId),
      details: `Đăng ký kíp trực: ${slot.shiftLabel}.`,
      createdAt: new Date(),
    });

    return updated;
  }

  async cancelRegistration(slotId: Identifier, user: any) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp trực không tồn tại');

    const userId = getActorId(user);
    const assigned = normalizeIdList(slot.assignedUserIds || []);
    if (!assigned.includes(userId)) {
      throw ApiError.badRequest('Bạn không đăng ký kíp trực này');
    }

    const settings = await dutySettingService.getSettings();
    const isAdmin = typeof user === 'object' && (user as any).role === 'admin';
    const isFull = assigned.length >= (slot.capacity || 1);

    if (!settings.allowUnregisterWhenFull && isFull && !isAdmin) {
      throw ApiError.badRequest('Kíp đã đủ người, không thể tự ý hủy. Hãy liên hệ Admin.');
    }

    const updated = await dutySlotsRepository.update(slot.id, {
      assignedUserIds: assigned.filter((id) => id !== userId),
      updatedAt: new Date().toISOString(),
    });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'cancel',
      slotId: normalizeId(slotId),
      userId,
      performerId: userId,
      details: `Hủy đăng ký kíp: ${slot.shiftLabel}.`,
      createdAt: new Date(),
    });

    return updated;
  }

  async markAttendance(slotId: Identifier, userIds: Identifier[], performerId: Identifier) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    const updated = await dutySlotsRepository.update(slotId, { attendedUserIds: userIds });

    const label = await this.getSlotLabel(slot);
    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      slotId: normalizeId(slotId),
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Điểm danh cho kíp: ${label}. Danh sách người có mặt: ${userIds.join(', ')}`,
      createdAt: new Date(),
    });

    return updated;
  }

  async generateWeekSlots(weekStartInput: string, actorId: Identifier) {
    const weekStart = getWeekStartISO(weekStartInput);
    const templates = await dutyTemplatesRepository.findMany({ isActive: true });

    for (const t of templates) {
      const shifts = await dutyShiftsRepository.findMany({ templateId: t.id, isTemplate: true });
      for (const s of shifts) {
        const days = s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        for (const dIdx of days) {
          const dateStr = dayjs.utc(weekStart).add(dIdx, 'day').format('YYYY-MM-DD');
          await dutyTemplatesService.stampTemplateShift(dateStr, s.id, actorId);
        }
      }
    }
    return { success: true };
  }

  async generateDaySlots(date: string, actorId: Identifier) {
    const templates = await dutyTemplatesRepository.findMany({ isActive: true });
    const dIdx = (dayjs.utc(date).day() + 6) % 7;

    for (const t of templates) {
      const shifts = await dutyShiftsRepository.findMany({ templateId: t.id, isTemplate: true });
      for (const s of shifts) {
        if ((s.daysOfWeek || []).includes(dIdx)) {
          await dutyTemplatesService.stampTemplateShift(date, s.id, actorId);
        }
      }
    }
    return { success: true };
  }

  async generateRangeSlots(
    startDate: string,
    endDate: string,
    actorId: Identifier,
    templateId?: any,
    mode: string = 'kips',
    jobId?: string,
  ) {
    let current = dayjs.utc(startDate).startOf('day');
    const end = dayjs.utc(endDate).startOf('day');
    const totalDays = end.diff(current, 'day') + 1;
    let processed = 0;

    while (current.isSameOrBefore(end, 'day')) {
      const dateStr = current.format('YYYY-MM-DD');
      const dIdx = (current.day() + 6) % 7;

      const filter: any = { isTemplate: true };
      if (templateId) filter.templateId = normalizeId(templateId);

      const shifts = await dutyShiftsRepository.findMany(filter);
      for (const s of shifts) {
        if ((s.daysOfWeek || []).includes(dIdx)) {
          await dutyTemplatesService.stampTemplateShift(dateStr, s.id, actorId, mode);
        }
      }

      processed++;
      if (jobId) {
        const percent = Math.floor((processed / totalDays) * 100);
        socketService.emitToRoom(jobId, 'job_progress', { percent, text: `Đang xử lý ngày ${dateStr}...` });
      }
      current = current.add(1, 'day');
    }

    return { success: true };
  }

  async deleteRangeSlots(startDate: string, endDate: string, performerId: Identifier) {
    const start = toUTCMidnight(startDate).toISOString();
    const end = dayjs.utc(endDate).endOf('day').toISOString();

    await dutySlotsRepository.deleteMany({
      shiftDate: { $gte: start, $lte: end },
    });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin xóa kíp trực trong khoảng từ ${startDate} đến ${endDate}`,
      createdAt: new Date(),
    });

    return { success: true };
  }

  async copyWeekSchedule(sourceWeekStart: string, targetWeekStart: string, actorId: Identifier) {
    const srcStart = getWeekStartISO(sourceWeekStart);
    const tgtStart = getWeekStartISO(targetWeekStart);

    const sourceSlots = await dutySlotsRepository.findMany({ weekStart: srcStart });

    for (const s of sourceSlots) {
      const diffDays = dayjs.utc(s.shiftDate).diff(dayjs.utc(srcStart), 'day');
      const targetDate = dayjs.utc(tgtStart).add(diffDays, 'day').toISOString();

      await dutySlotsRepository.create({
        ...s,
        id: undefined,
        _id: undefined,
        shiftDate: targetDate,
        weekStart: tgtStart,
        assignedUserIds: [],
        attendedUserIds: [],
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    return { success: true };
  }

  async deleteWeeklySlots(weekStart: string) {
    const start = getWeekStartISO(weekStart);
    await dutySlotsRepository.deleteMany({ weekStart: start });
    return { success: true };
  }

  async deleteShiftSlots(date: string, shiftId: Identifier, performerId: Identifier) {
    const isoDate = toUTCMidnight(date).toISOString();
    await dutySlotsRepository.deleteMany({ shiftDate: isoDate, shiftId: normalizeId(shiftId) });

    await dutyLogsRepository.create({
      type: 'manual_update',
      action: 'system',
      userId: normalizeId(performerId),
      performerId: normalizeId(performerId),
      details: `Admin xóa các kíp của ca #${shiftId} ngày ${date}`,
      createdAt: new Date(),
    });

    return { success: true };
  }

  async addShiftToDay(
    date: string,
    shiftTemplateId: number,
    actorId: Identifier,
    overrides: any = null,
    mode: string = 'kips',
  ) {
    const isoDate = toUTCMidnight(date).toISOString();
    const actualShift = await dutyTemplatesService.stampTemplateShift(isoDate, shiftTemplateId, actorId, mode);
    if (!actualShift) throw ApiError.badRequest('Không thể tạo ca từ bản mẫu này');

    if (overrides) {
      await dutyShiftsRepository.update(actualShift.id, {
        name: overrides.name || actualShift.name,
        startTime: overrides.startTime || actualShift.startTime,
        endTime: overrides.endTime || actualShift.endTime,
      });
    }

    const kips = await dutyKipsRepository.findMany({ shiftId: actualShift.id });
    const kipIds = kips.map((k) => k.id);
    const slots = await dutySlotsRepository.findMany({
      kipId: { $in: kipIds },
    });

    return { success: true, slots };
  }

  async removeShiftFromDay(date: string, shiftInstanceId: number) {
    const shift = await dutyShiftsRepository.findById(shiftInstanceId);
    if (!shift) throw ApiError.notFound('Ca thực tế không tồn tại');

    const kips = await dutyKipsRepository.findMany({ shiftId: shift.id });

    for (const kip of kips) {
      const kipSlots = await dutySlotsRepository.findMany({ kipId: kip.id });
      const kipSlotIds = kipSlots.map((s) => s.id);

      if (kipSlotIds.length > 0) {
        await dutySwapRequestsRepository.deleteMany({ dutySlotId: { $in: kipSlotIds } });
        await dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: kipSlotIds } });
        await dutySlotsRepository.deleteMany({ kipId: kip.id });
      }

      await dutyKipsRepository.delete(kip.id);
    }

    await dutyShiftsRepository.delete(shift.id);

    return { success: true };
  }

  async updateActualShift(shiftId: number, data: GenericRecord) {
    return await dutyShiftsRepository.update(shiftId, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }

  async deleteActualKip(kipId: number) {
    const kip = await dutyKipsRepository.findById(kipId);
    if (!kip) throw ApiError.notFound('Kíp thực tế không tồn tại');

    const slots = await dutySlotsRepository.findMany({ kipId: kip.id });
    const slotIds = slots.map((s) => s.id);

    if (slotIds.length > 0) {
      await dutySwapRequestsRepository.deleteMany({ dutySlotId: { $in: slotIds } });
      await dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: slotIds } });
      await dutySlotsRepository.deleteMany({ kipId: kip.id });
    }

    await dutyKipsRepository.delete(kip.id);

    return { success: true };
  }

  async getStats() {
    const slots = (await dutySlotsRepository.findAll()) || [];
    const leaves = (await dutyLeaveRequestsRepository.findAll()) || [];
    const swaps = (await dutySwapRequestsRepository.findAll()) || [];

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
