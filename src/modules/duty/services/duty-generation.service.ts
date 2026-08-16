import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import ApiError from '@utils/api-error';
import { socketService } from '../../socket/socket.service';
import dayjs from 'dayjs';
import { Identifier, normalizeId, toUTCMidnight, getWeekStartISO } from './duty-utils';
import dutyLogsService from './duty-logs.service';
import dutySlotsService from './duty-slots.service';
import dutyTemplatesService from './duty-templates.service';

const deduplicateStructure = (structArr: any[]) => {
  if (!Array.isArray(structArr)) return [];
  return structArr.reduce((acc: any[], item: any) => {
    if (!item) return acc;
    const key = `${(item.label || '').toLowerCase().trim()}_${(item.positions || []).sort().join(',')}`;
    const existing = acc.find(
      (x) => `${(x.label || '').toLowerCase().trim()}_${(x.positions || []).sort().join(',')}` === key,
    );
    if (existing) {
      existing.slots = (Number(existing.slots || existing.count) || 0) + (Number(item.slots || item.count) || 0);
    } else {
      acc.push({ ...item });
    }
    return acc;
  }, []);
};

class DutyGenerationService {
  async stampTemplateShift(date: string, templateShiftId: Identifier, actorId: Identifier, mode: string = 'all') {
    const dayRecord = await dutySlotsService.findOrCreateDay(date, actorId);
    const ts = await dutyTemplatesRepository.findById(templateShiftId);
    if (!ts) return null;

    let actualShift = await dutyShiftsRepository.findOne({ date, fromTemplateShiftId: ts.id });
    if (!actualShift) {
      actualShift = await dutyShiftsRepository.create({
        dayId: dayRecord.id,
        date,
        name: ts.name,
        startTime: ts.startTime,
        endTime: ts.endTime,
        isSpecialEvent: !!ts.isSpecialEvent,
        fromTemplateShiftId: ts.id,
        slotStructure: deduplicateStructure(ts.slotStructure || []),
        status: 'open',
        createdBy: normalizeId(actorId),
      });
    }

    if (mode === 'shifts') return actualShift;

    const tKips = await dutyTemplatesRepository.findKipsByShiftId(ts.id);
    for (const tk of tKips) {
      const dayOfWeek = (dayjs.utc(date).day() + 6) % 7;
      if (!(tk.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek)) continue;

      let ak = await dutyKipsRepository.findOne({ shiftId: actualShift.id, fromTemplateKipId: tk.id });
      if (!ak) {
        ak = await dutyKipsRepository.create({
          shiftId: actualShift.id,
          date,
          name: tk.name,
          coefficient: tk.coefficient,
          capacity: tk.capacity,
          startTime: tk.startTime,
          endTime: tk.endTime,
          fromTemplateKipId: tk.id,
          slotStructure: deduplicateStructure(tk.slotStructure || []),
          config: tk.config || {},
          status: 'open',
        });
      }

      const existingSlot = await dutySlotsRepository.findOne({ kipId: ak.id });
      if (!existingSlot) {
        const weekStart = dayjs.utc(date).startOf('isoWeek').toDate();
        const structure = deduplicateStructure(ak.slotStructure || tk.slotStructure || []);
        const structureTotal = Array.isArray(structure)
          ? structure.reduce((a: number, c: any) => a + Number(c?.slots || c?.count || 0), 0)
          : 0;
        const capacity = Math.max(Number(ak.capacity || tk.capacity || 1), structureTotal);

        await dutySlotsRepository.create({
          kipId: ak.id,
          shiftId: actualShift.id,
          dayId: dayRecord.id,
          weekStart,
          shiftDate: date,
          startTime: ak.startTime,
          endTime: ak.endTime,
          capacity,
          coefficient: Number(ak.coefficient ?? tk.coefficient ?? 1),
          slotStructure: structure,
          config: ak.config || tk.config || {},
          status: 'open',
          createdBy: normalizeId(actorId),
          note: 'INSTANCE',
        });
      }
    }
    return actualShift;
  }

  async generateWeekSlots(weekStart: string, actorId: Identifier) {
    const startIso = getWeekStartISO(weekStart);
    const ws = new Date(startIso);
    const we = new Date(startIso);
    we.setUTCDate(we.getUTCDate() + 6);

    const existingShifts = await dutyShiftsRepository.findMany({
      date_gte: ws.toISOString(),
      date_lte: we.toISOString(),
    });
    if (existingShifts.length > 0) throw ApiError.badRequest('Lịch đã tồn tại cho tuần này');

    const [assignments, defaultGroup] = await Promise.all([
      dutyTemplateAssignmentsRepository.findMany({ startDate_lte: we.toISOString(), endDate_gte: ws.toISOString() }),
      dutyTemplatesRepository.findDefault(),
    ]);

    for (let i = 0; i < 7; i++) {
      const d = new Date(startIso);
      d.setUTCDate(d.getUTCDate() + i);
      const isoDate = d.toISOString();
      const assignment = assignments.find((a: any) => d >= new Date(a.startDate) && d <= new Date(a.endDate));
      const groupId = assignment?.templateId || defaultGroup?.id;
      if (!groupId) continue;

      const templateShifts = await dutyTemplatesRepository.findShiftsByGroupId(normalizeId(groupId));
      for (const ts of templateShifts) {
        const dIdx = (d.getUTCDay() + 6) % 7;
        if ((ts.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dIdx)) {
          await this.stampTemplateShift(isoDate, ts.id, actorId);
        }
      }
    }
    return { success: true };
  }

  async generateDaySlots(date: string, actorId: Identifier) {
    const d = toUTCMidnight(date);
    const isoDate = d.toISOString();
    const dayOfWeek = (d.getUTCDay() + 6) % 7;

    const assignment = await dutyTemplateAssignmentsRepository.findOne({
      startDate_lte: isoDate,
      endDate_gte: isoDate,
    });
    let effectiveTemplateId = assignment?.templateId;
    if (!effectiveTemplateId) {
      const defaultTemplate = await dutyTemplatesRepository.findDefault();
      effectiveTemplateId = defaultTemplate?.id;
    }
    if (!effectiveTemplateId) return { success: false, message: 'No template assigned' };

    const templateShifts = await dutyTemplatesRepository.findShiftsByGroupId(normalizeId(effectiveTemplateId));
    const results = [];
    for (const ts of templateShifts) {
      if ((ts.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dayOfWeek)) {
        results.push(await this.stampTemplateShift(isoDate, ts.id, actorId));
      }
    }
    return { success: true, results };
  }

  async generateRangeSlots(
    startDate: string,
    endDate: string,
    actorId: Identifier,
    templateId?: Identifier,
    mode: string = 'all',
    jobId?: string,
  ) {
    const s = toUTCMidnight(startDate);
    const e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);
    if (e < s) throw ApiError.badRequest('Ngày kết thúc phải sau ngày bắt đầu');

    if (jobId) socketService.emitToRoom(jobId, 'job_progress', { percent: 5, text: 'Bắt đầu quá trình lập lịch...' });

    let effectiveTemplateId = templateId;
    if (!effectiveTemplateId) {
      const assignments = await dutyTemplateAssignmentsRepository.findMany({
        startDate_lte: e.toISOString(),
        endDate_gte: s.toISOString(),
      });
      const assignment = assignments.find(
        (a: any) =>
          dayjs.utc(s).isSameOrAfter(dayjs.utc(a.startDate), 'day') &&
          dayjs.utc(e).isSameOrBefore(dayjs.utc(a.endDate), 'day'),
      );
      effectiveTemplateId = assignment?.templateId || (await dutyTemplatesRepository.findDefault())?.id;
    }
    if (!effectiveTemplateId) return { success: false, message: 'Không tìm thấy Bản mẫu để áp dụng' };

    const templateShifts = await dutyTemplatesRepository.findShiftsByGroupId(normalizeId(effectiveTemplateId));
    const datesToProcess: string[] = [];
    let curr = new Date(s);
    while (curr <= e) {
      datesToProcess.push(curr.toISOString());
      curr.setUTCDate(curr.getUTCDate() + 1);
    }

    const totalDays = datesToProcess.length;
    const results = [];
    for (let i = 0; i < totalDays; i++) {
      const isoDate = datesToProcess[i];
      if (jobId && i % 5 === 0) {
        socketService.emitToRoom(jobId, 'job_progress', {
          percent: Math.floor(10 + (i / totalDays) * 85),
          text: `Đang xử lý ngày ${dayjs(isoDate).format('DD/MM')}...`,
        });
      }
      for (const ts of templateShifts) {
        if ((ts.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes((new Date(isoDate).getUTCDay() + 6) % 7)) {
          results.push(await this.stampTemplateShift(isoDate, ts.id, actorId, mode));
        }
      }
    }
    if (jobId) socketService.emitToRoom(jobId, 'job_progress', { percent: 100, text: 'Lập lịch hoàn tất!' });
    return { success: true, results };
  }

  async copyWeekSchedule(sourceWeekStart: string, targetWeekStart: string, actorId: Identifier) {
    const srcIso = getWeekStartISO(sourceWeekStart);
    const targetIso = getWeekStartISO(targetWeekStart);
    const wsTarget = new Date(targetIso),
      weTarget = new Date(targetIso);
    weTarget.setUTCDate(weTarget.getUTCDate() + 6);

    if (await dutyShiftsRepository.findOne({ date_gte: wsTarget.toISOString(), date_lte: weTarget.toISOString() }))
      throw ApiError.badRequest('Tuần đích đã có lịch trực');

    const wsSource = new Date(srcIso),
      weSource = new Date(srcIso);
    weSource.setUTCDate(weSource.getUTCDate() + 6);
    const sourceShifts = await dutyShiftsRepository.findMany({
      date_gte: wsSource.toISOString(),
      date_lte: weSource.toISOString(),
    });
    if (sourceShifts.length === 0) throw ApiError.badRequest('Tuần nguồn không có lịch trực');

    for (const ss of sourceShifts) {
      const targetDate = dayjs
        .utc(targetIso)
        .add(dayjs.utc(ss.date).diff(dayjs.utc(srcIso), 'day'), 'day')
        .toISOString();

      const dayRecord = await dutySlotsService.findOrCreateDay(targetDate, actorId);
      const newShift = await dutyShiftsRepository.create({
        ...ss,
        id: undefined,
        _id: undefined,
        dayId: dayRecord.id,
        date: targetDate,
        slotStructure: deduplicateStructure(ss.slotStructure || []),
        status: 'open',
        createdBy: normalizeId(actorId),
      });

      const kips = await dutyKipsRepository.findMany({ shiftId: ss.id });
      for (const k of kips) {
        const newKip = await dutyKipsRepository.create({
          ...k,
          id: undefined,
          _id: undefined,
          shiftId: newShift.id,
          date: targetDate,
          slotStructure: deduplicateStructure(k.slotStructure || []),
          config: k.config || {},
          status: 'open',
        });

        const slots = await dutySlotsRepository.findMany({ kipId: k.id });
        for (const s of slots) {
          await dutySlotsRepository.create({
            ...s,
            id: undefined,
            _id: undefined,
            kipId: newKip.id,
            shiftId: newShift.id,
            dayId: dayRecord.id,
            shiftDate: targetDate,
            startTime: s.startTime || k.startTime,
            endTime: s.endTime || k.endTime,
            capacity: s.capacity || k.capacity || 1,
            coefficient: Number(s.coefficient ?? k.coefficient ?? 1),
            slotStructure: deduplicateStructure(s.slotStructure || k.slotStructure || []),
            config: s.config || k.config || {},
            assignedUserIds: [],
            attendedUserIds: [],
            status: 'open',
            createdBy: normalizeId(actorId),
            note: 'COPIED_INSTANCE',
          });
        }
      }
    }
    await dutyLogsService.log(
      'manual_update',
      'system',
      `Admin sao chép lịch trực từ tuần ${sourceWeekStart} sang tuần ${targetWeekStart}.`,
      actorId,
    );
    return { success: true };
  }

  async deleteWeeklySlots(weekStart: string) {
    const ws = dayjs(weekStart).startOf('isoWeek' as any),
      we = ws.endOf('isoWeek' as any);
    const range = { shiftDate_gte: ws.toDate(), shiftDate_lte: we.toDate() };
    const rangeDate = { date_gte: ws.toDate(), date_lte: we.toDate() };
    await Promise.all([
      dutySlotsRepository.deleteMany(range),
      dutyKipsRepository.deleteMany(rangeDate),
      dutyShiftsRepository.deleteMany(rangeDate),
    ]);
    return { success: true };
  }

  async deleteRangeSlots(startDate: string, endDate: string, performerId: Identifier) {
    const s = toUTCMidnight(startDate),
      e = toUTCMidnight(endDate);
    e.setUTCHours(23, 59, 59, 999);
    const count = await dutySlotsRepository.deleteMany({
      shiftDate_gte: s.toISOString(),
      shiftDate_lte: e.toISOString(),
    });
    await dutyLogsService.log(
      'unassigned',
      'removed',
      `Admin xóa hàng loạt kíp trực từ ${startDate} đến ${endDate}. Số lượng: ${count}`,
      performerId,
    );
    return count;
  }

  async deleteShiftSlots(date: string, shiftId: number, performerId: Identifier) {
    const kips = await dutyKipsRepository.findByShiftId(shiftId);
    for (const k of kips) {
      await dutySlotsRepository.deleteMany({ kipId: k.id });
      await dutyKipsRepository.delete(k.id);
    }
    await dutyShiftsRepository.delete(shiftId);
    return { success: true };
  }

  async addShiftToDay(
    date: string,
    shiftTemplateId: number,
    actorId: Identifier,
    overrides: any = null,
    mode: string = 'kips',
  ) {
    const actualShift = await this.stampTemplateShift(toUTCMidnight(date).toISOString(), shiftTemplateId, actorId);
    if (!actualShift) throw ApiError.badRequest('Không thể tạo ca từ bản mẫu này');
    if (overrides)
      await dutyShiftsRepository.update(actualShift.id, {
        name: overrides.name || actualShift.name,
        startTime: overrides.startTime || actualShift.startTime,
        endTime: overrides.endTime || actualShift.endTime,
      });
    const kips = await dutyKipsRepository.findMany({ shiftId: actualShift.id });
    const slots = await dutySlotsRepository.findMany({ kipId: { $in: kips.map((k) => k.id) } });
    return { success: true, slots };
  }

  async removeShiftFromDay(_date: string, shiftInstanceId: number) {
    const shift = await dutyShiftsRepository.findById(shiftInstanceId);
    if (!shift) throw ApiError.notFound('Ca thực tế không tồn tại');
    const kips = await dutyKipsRepository.findMany({ shiftId: shift.id });
    for (const kip of kips) {
      const slots = await dutySlotsRepository.findMany({ kipId: kip.id });
      if (slots.length > 0) {
        const ids = slots.map((s) => s.id);
        await Promise.all([
          dutySwapRequestsRepository.deleteMany({
            $or: [{ fromSlotId: { $in: ids } }, { toSlotId: { $in: ids } }],
          }),
          dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: ids } }),
          dutySlotsRepository.deleteMany({ kipId: kip.id }),
        ]);
      }
      await dutyKipsRepository.delete(kip.id);
    }
    const orphans = await dutySlotsRepository.findMany({ shiftId: shift.id });
    if (orphans.length > 0) {
      const ids = orphans.map((s) => s.id);
      await Promise.all([
        dutySwapRequestsRepository.deleteMany({
          $or: [{ fromSlotId: { $in: ids } }, { toSlotId: { $in: ids } }],
        }),
        dutyLeaveRequestsRepository.deleteMany({ slotId: { $in: ids } }),
        dutySlotsRepository.deleteMany({ shiftId: shift.id }),
      ]);
    }
    await dutyShiftsRepository.delete(shift.id);
    return { success: true };
  }

  async createTemplateAssignment(data: any, actorId: any) {
    const startDate = toUTCMidnight(data.startDate);
    const endDate = dayjs.utc(data.endDate).endOf('day').toDate();
    const templateId = parseInt(data.templateId, 10);
    const mode = data.mode || 'kips';
    const jobId = data.jobId;

    if (jobId)
      socketService.emitToRoom(jobId, 'job_progress', { percent: 5, text: 'Đang phân tích cấu trúc Bản mẫu...' });

    const shifts = await dutyTemplatesService.getShiftTemplates(templateId);
    if (!shifts || shifts.length === 0) throw ApiError.badRequest('Bản mẫu này không có ca trực nào để áp dụng.');

    let current = dayjs.utc(startDate).startOf('day');
    const end = dayjs.utc(endDate).startOf('day');
    const datesToInit: string[] = [];
    while (current.isSameOrBefore(end, 'day')) {
      datesToInit.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    const results: any[] = [];
    const BATCH_SIZE = 15;
    for (let i = 0; i < datesToInit.length; i += BATCH_SIZE) {
      if (jobId)
        socketService.emitToRoom(jobId, 'job_progress', {
          percent: Math.floor(10 + (i / datesToInit.length) * 85),
          text: `Đang xử lý dữ liệu từ ngày ${dayjs(datesToInit[i]).format('DD/MM')}...`,
        });
      const batchDates = datesToInit.slice(i, i + BATCH_SIZE);
      const batchPromises = batchDates.map(async (dateStr) => {
        const dIdx = (dayjs.utc(dateStr).day() + 6) % 7;
        for (const s of shifts as any[]) {
          if ((s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6]).includes(dIdx))
            await this.stampTemplateShift(dateStr, s.id, actorId, mode);
        }
        return { date: dateStr };
      });
      results.push(...(await Promise.all(batchPromises)));
    }
    if (jobId) socketService.emitToRoom(jobId, 'job_progress', { percent: 100, text: 'Hoàn tất chiến dịch lập lịch.' });
    return { success: true, results };
  }
}

export default new DutyGenerationService();
