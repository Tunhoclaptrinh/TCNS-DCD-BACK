import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import ExcelJS from 'exceljs';
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
import rewardPenaltyService from '@modules/reward-penalties/services/reward-penalty.service';
import dutyPeriodConfigsService from './duty-period-configs.service';
import { PENALTY_RULES } from '@modules/reward-penalties/constants/penalty-rules';

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
        expand: 'assignedUsers,attendedUsers,kip,shift',
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
      const attendedIds = normalizeIdList(slot.attendedUserIds || []);
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
            studentId: user.studentId,
          })),
        attendedUsers: attendedIds
          .map((id) => userMap.get(id))
          .filter(Boolean)
          .map((user: any) => ({
            id: user.id,
            name: user.name,
            role: user.role,
            avatar: user.avatar,
            position: user.position,
            studentId: user.studentId,
          })),
        violations: violations.filter((v: any) => normalizeId(v.slotId) === normalizeId(slot.id)),
        leaveRequests: leaveRequests.filter((r: any) => normalizeId(r.slotId) === normalizeId(slot.id)),
        swapRequests: swapRequests.filter((r: any) => normalizeId(r.fromSlotId) === normalizeId(slot.id)),
        isSpecialEvent: !!(shift?.isSpecialEvent || kip?.isSpecialEvent),
      };
    });

    const templateData = shifts.map((s: any) => ({
      ...s,
      kips: kips
        .filter((k: any) => normalizeId(k.shiftId) === normalizeId(s.id))
        .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
    }));

    // Calculate user quota if userId is provided
    let userMetadata: any = null;
    const userId = options.userId;
    if (userId) {
      const fullUser = await usersRepository.findById(userId);
      if (fullUser) {
        const settings = await dutySettingsService.getSettings();
        const periodConfig = await dutyPeriodConfigsService.getConfig(ws.toISOString(), we.toISOString());

        const limitMode = settings.kipLimitMode || 'quota';
        let weeklyQuota = Number(settings.weeklyKipLimit) || 0;

        if (limitMode === 'quota') {
          const defaultQuota =
            periodConfig.defaultQuota !== undefined && periodConfig.defaultQuota !== null
              ? Number(periodConfig.defaultQuota)
              : 0;
          const quotaRules = periodConfig.quotaRules || [];
          const pos = String(fullUser.position || '').toLowerCase();
          const uDept = String(fullUser.department?.name || fullUser.department || '').trim();

          const getRoleGroup = (user: any) => {
            const role = String(user.role || '').toLowerCase();
            const position = String(user.position || '').toLowerCase();

            // Collaborators
            if (role === 'ctv' || position === 'ctv') return 'ctv';

            // Official members (admin, manager, leader, member or any other active role)
            return 'member_official';
          };
          const roleGroup = getRoleGroup(fullUser);

          const findMatchingRule = () => {
            // Priority:
            // 1. Specific User (MSV)
            const userRule = quotaRules.find(
              (r: any) => r.type === 'user' && String(r.target) === String(fullUser.studentId || userId),
            );
            if (userRule) return userRule;

            // 2. Role based rules
            const roleMatch = (r: any) => {
              if (r.type === 'dt') return pos === 'dt';
              if (r.type === 'tb') return pos === 'tb';
              if (r.type === 'pb') return pos === 'pb';
              if (r.type === 'ctv') return roleGroup === 'ctv';
              if (r.type === 'member_all') return roleGroup === 'member_official';
              return false;
            };

            // 2a. Role + Specific Dept
            const roleDeptRule = quotaRules.find(
              (r: any) => roleMatch(r) && r.target !== 'all' && String(r.target) === uDept,
            );
            if (roleDeptRule) return roleDeptRule;

            // 2b. Role + All Depts
            const roleAllRule = quotaRules.find((r: any) => roleMatch(r) && r.target === 'all');
            if (roleAllRule) return roleAllRule;

            return null;
          };

          const rule = findMatchingRule();
          weeklyQuota = rule ? Number(rule.quota) : defaultQuota;
          const cycle = rule?.cycle || 'week';
          let registeredKips = 0;

          if (cycle === 'month') {
            const startOfMonth = dayjs(options.startDate).startOf('month').toISOString();
            const endOfMonth = dayjs(options.startDate).endOf('month').toISOString();

            const allSlotsInMonth = await dutySlotsRepository.findMany({
              shiftDate_gte: startOfMonth,
              shiftDate_lte: endOfMonth,
            });

            const userSlotsInMonth = allSlotsInMonth.filter((s: any) =>
              normalizeIdList(s.assignedUserIds || []).includes(userId),
            );

            const userKipIds = userSlotsInMonth.map((s: any) => s.kipId).filter(Boolean);
            const userKips = kips.filter((k: any) => userKipIds.includes(normalizeId(k.id)));
            registeredKips = userKips.reduce((acc: number, k: any) => acc + (Number(k.coefficient) || 1), 0);
          } else {
            const userSlotsInWeek = slots.filter((s: any) => normalizeIdList(s.assignedUserIds || []).includes(userId));
            const userKipIds = userSlotsInWeek.map((s: any) => s.kipId).filter(Boolean);
            const userKips = kips.filter((k: any) => userKipIds.includes(normalizeId(k.id)));
            registeredKips = userKips.reduce((acc: number, k: any) => acc + (Number(k.coefficient) || 1), 0);
          }

          userMetadata = {
            weeklyQuota: settings.weeklyLimitEnabled ? weeklyQuota : 0,
            registeredKips,
            limitMode,
            cycle,
            weeklyLimitEnabled: settings.weeklyLimitEnabled !== false,
          };
        }
      }
    }

    return {
      success: true,
      data: {
        slots,
        days,
        assignments,
        templates: templateData,
        userMetadata,
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
      isSpecialEvent: !!payload.isSpecialEvent,
      status: 'open',
      createdBy: normalizeId(actorId),
      note: payload.note || '',
      slotStructure: payload.slotStructure || [],
      config: payload.config || {},
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
      slotStructure: createdKip.slotStructure || [],
      config: createdKip.config || {},
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
      slotStructure: payload.slotStructure || kip.slotStructure || [],
      config: payload.config || kip.config || {},
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

      // Auto-increment capacity if assigned users exceed current capacity
      const currentCapacity = payload.capacity !== undefined ? payload.capacity : slot.capacity || 0;
      if (newIds.length > currentCapacity) {
        patch.capacity = newIds.length;
      }

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
    const performer = user as any;
    const isAdmin = performer.role === 'admin' || performer.role === 'staff';

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
    const limitMode = settings.kipLimitMode || 'quota';
    let weeklyLimit = Number(settings.weeklyKipLimit) || 0;

    const fullUser = typeof user === 'object' ? user : await usersRepository.findById(userId);
    if (!fullUser) throw ApiError.notFound('Người dùng không tồn tại');

    let rule: any = null;

    // If quota mode, calculate limit based on user rules
    if (limitMode === 'quota') {
      const periodConfig = await dutyPeriodConfigsService.getConfig(slot.shiftDate, slot.shiftDate);
      const defaultQuota = 0;
      const quotaRules = periodConfig.quotaRules || settings.quotaRules || [];
      const pos = String(fullUser.position || '').toLowerCase();
      const uDept = String(fullUser.department?.name || fullUser.department || '').trim();

      const getRoleGroup = (u: any) => {
        const role = String(u.role || '').toLowerCase();
        const position = String(u.position || '').toLowerCase();
        if (role === 'ctv' || position === 'ctv') return 'ctv';
        return 'member_official';
      };
      const roleGroup = getRoleGroup(fullUser);

      const findMatchingRule = () => {
        // Priority logic (matches getSlots)
        const userRule = quotaRules.find(
          (r: any) => r.type === 'user' && String(r.target) === String(fullUser.studentId || userId),
        );
        if (userRule) return userRule;

        const roleMatch = (r: any) => {
          if (r.type === 'dt') return pos === 'dt';
          if (r.type === 'tb') return pos === 'tb';
          if (r.type === 'pb') return pos === 'pb';
          if (r.type === 'ctv') return roleGroup === 'ctv';
          if (r.type === 'member_all') return roleGroup === 'member_official';
          return false;
        };

        const roleDeptRule = quotaRules.find(
          (r: any) => roleMatch(r) && r.target !== 'all' && String(r.target) === uDept,
        );
        if (roleDeptRule) return roleDeptRule;

        const roleAllRule = quotaRules.find((r: any) => roleMatch(r) && r.target === 'all');
        if (roleAllRule) return roleAllRule;

        return null;
      };

      rule = findMatchingRule();
      weeklyLimit = rule ? Number(rule.quota) : defaultQuota;
    }

    if (settings.weeklyLimitEnabled && (weeklyLimit > 0 || limitMode === 'quota')) {
      const cycle = rule?.cycle || 'week';
      let currentTotal = 0;

      if (cycle === 'month') {
        const startOfMonth = dayjs(slot.shiftDate).startOf('month').toISOString();
        const endOfMonth = dayjs(slot.shiftDate).endOf('month').toISOString();

        const allSlotsInMonth = await dutySlotsRepository.findMany({
          shiftDate_gte: startOfMonth,
          shiftDate_lte: endOfMonth,
        });

        const userSlotsInMonth = allSlotsInMonth.filter((s: any) =>
          normalizeIdList(s.assignedUserIds || []).includes(userId),
        );

        const userKipIds = userSlotsInMonth.map((s: any) => s.kipId).filter(Boolean);
        const userKips = await dutyKipsRepository.findMany({ id_in: userKipIds });
        currentTotal = userKips.reduce((acc: number, k: any) => acc + (Number(k.coefficient) || 1), 0);
      } else {
        const allSlotsInWeek = await dutySlotsRepository.findMany({
          weekStart: new Date(slot.weekStart).toISOString(),
        });
        const userSlotsInWeek = allSlotsInWeek.filter((s: any) =>
          normalizeIdList(s.assignedUserIds || []).includes(userId),
        );

        const userKipIds = userSlotsInWeek.map((s: any) => s.kipId).filter(Boolean);
        const userKips = await dutyKipsRepository.findMany({ id_in: userKipIds });
        currentTotal = userKips.reduce((acc: number, k: any) => acc + (Number(k.coefficient) || 1), 0);
      }

      const currentKip = await dutyKipsRepository.findById(slot.kipId);
      const totalAfterJoin = currentTotal + (Number(currentKip?.coefficient) || 1);

      if (totalAfterJoin > weeklyLimit) {
        const cycleLabel = cycle === 'month' ? 'tháng' : 'tuần';
        throw ApiError.badRequest(
          `Bạn đã đạt giới hạn đăng ký trong ${cycleLabel} (${weeklyLimit} kíp). Hiện tại: ${currentTotal} kíp. Kíp này tính ${currentKip?.coefficient} kíp.`,
        );
      }
    }

    let maxCapacity = Number(slot.capacity);
    if (!maxCapacity || isNaN(maxCapacity)) {
      const kip = await dutyKipsRepository.findById(slot.kipId);
      maxCapacity = Number(kip?.capacity) || 1;
    }

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
        if (occupantsInGroup >= requirement.slots && !isAdmin)
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
        if (unmappedOccupants >= freeSlotsTotal && freeSlotsTotal >= 0 && !isAdmin) {
          throw ApiError.badRequest(
            'Hết chỗ cho vị trí của bạn (Các chỗ còn lại đã được dành riêng cho chức vụ khác).',
          );
        }
      }
    }

    if (assigned.length >= maxCapacity) {
      if (isAdmin) {
        // Admin can bypass and auto-increase capacity
        maxCapacity = assigned.length + 1;
      } else {
        throw ApiError.badRequest('Ca trực đã đầy, vui lòng chọn kíp khác.');
      }
    }

    const updated = await dutySlotsRepository.update(slotId, {
      assignedUserIds: [...assigned, userId].map(Number),
      capacity: maxCapacity,
      updatedAt: new Date().toISOString(),
    });

    const slotLabel = await this.getSlotLabel(slot);
    await notificationService.notifyUser(userId, {
      title: 'Đăng ký kíp trực thành công',
      message: `Bạn đã đăng ký: ${slotLabel} ngày ${new Date(slot.shiftDate).toLocaleDateString('vi-VN')}`,
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

  async markAttendance(slotId: Identifier, userIds: Identifier[], performer: any, isIncremental: boolean = false) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    // Leadership check
    await this.checkLeadership(slot, performer);

    const currentAssigned = normalizeIdList(slot.assignedUserIds || []).map(Number);
    const currentAttended = normalizeIdList(slot.attendedUserIds || []).map(Number);
    const incomingIds = normalizeIdList(userIds || []).map(Number);

    let newAttended: number[];
    let newAssigned: number[];

    if (isIncremental) {
      // Merge: Add new ones, keep old ones
      newAttended = Array.from(new Set([...currentAttended, ...incomingIds]));
      newAssigned = Array.from(new Set([...currentAssigned, ...incomingIds]));
    } else {
      // Replace: Use the incoming list exactly as it is
      newAttended = incomingIds;
      // For assigned, we usually don't want to remove people if we are just marking attendance
      // but if the admin specifically uses this for assignment too, we might want to be careful.
      // However, for attendance, we usually just want to make sure everyone attended is also assigned.
      newAssigned = Array.from(new Set([...currentAssigned, ...incomingIds]));
    }

    const updated = await dutySlotsRepository.update(slotId, {
      assignedUserIds: newAssigned,
      attendedUserIds: newAttended,
      updatedAt: new Date().toISOString(),
    });

    const label = await this.getSlotLabel(slot);

    // --- AUTOMATIC PENALTY FOR ABSENTEES ---
    const settings = await dutySettingsService.getSettings();
    const assignedIds = newAssigned;
    const attendedIds = newAttended;
    const absentIds = assignedIds.filter((id) => !attendedIds.includes(id));

    if (absentIds.length > 0) {
      const dateStr = dayjs(slot.shiftDate).format('YYYY-MM-DD');

      await Promise.all(
        absentIds.map(async (uid) => {
          const leave = await dutyLeaveRequestsRepository.findOne({
            slotId: normalizeId(slotId),
            userId: normalizeId(uid),
            status: 'approved',
          });

          if (!leave) {
            await rewardPenaltyService.createEntry(
              {
                userId: uid,
                type: 'penalty',
                amount: settings.penaltyAbsentNoPermission || 50000,
                reason: `Vắng trực không phép (${label} ngày ${dateStr})`,
                eventDate: slot.shiftDate,
                note: `Hệ thống tự động ghi nhận khi điểm danh.`,
              },
              getActorId(performer),
            );
          }
        }),
      );
    }

    await dutyLogsService.log(
      'manual_update',
      'system',
      `Điểm danh cho kíp: ${label}. Danh sách người có mặt: ${userIds.join(', ')}`,
      getActorId(performer),
      undefined,
      slotId,
    );

    return updated;
  }

  async selfCheckIn(slotId: Identifier, user: any, ip: string) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp trực không tồn tại');

    const userId = getActorId(user);
    const assignedIds = normalizeIdList(slot.assignedUserIds || []);
    if (!assignedIds.includes(userId as number)) {
      throw ApiError.badRequest('Bạn không có lịch trực trong kíp này');
    }

    // 1. Check IP
    const settings = await dutySettingsService.getSettings();
    if (settings.allowedIpRanges && !isIpAllowed(ip, settings.allowedIpRanges)) {
      throw ApiError.badRequest(`Địa chỉ mạng (${ip}) không hợp lệ để điểm danh tại văn phòng.`);
    }

    // 2. Check time window (+/- 2 mins)
    const now = dayjs();
    const shiftDate = dayjs(slot.shiftDate).format('YYYY-MM-DD');
    const startTimeStr = `${shiftDate} ${slot.startTime}`;
    const startTime = dayjs(startTimeStr);

    const diffMins = Math.abs(now.diff(startTime, 'minute'));
    if (diffMins > 2) {
      throw ApiError.badRequest(
        `Chỉ có thể tự điểm danh trong vòng 2 phút trước và sau giờ bắt đầu (${slot.startTime})`,
      );
    }

    const attendedIds = normalizeIdList(slot.attendedUserIds || []);
    if (attendedIds.includes(userId as number)) {
      return { success: true, message: 'Bạn đã điểm danh rồi', data: slot };
    }

    const newAttendedIds = [...attendedIds, userId as number];
    const attendanceData = slot.attendanceData || {};
    attendanceData[String(userId)] = {
      time: now.toISOString(),
      ip: ip,
      method: 'self_checkin',
    };

    const updatePayload: any = {
      attendedUserIds: newAttendedIds,
      attendanceData: attendanceData,
      updatedAt: now.toISOString(),
    };

    // 3. Leadership succession logic
    const defaultLeaderId = assignedIds[0];
    const isDefaultLeader = userId === defaultLeaderId;

    // If default leader arrives, they definitely take power (or keep it)
    if (isDefaultLeader) {
      updatePayload.tempLeaderId = null; // Use null to indicate default leader is present
    } else if (!slot.tempLeaderId) {
      // Someone else arrives first, and default leader isn't here yet
      updatePayload.tempLeaderId = userId;
    }

    const updated = await dutySlotsRepository.update(slotId, updatePayload);

    await dutyLogsService.log(
      'manual_update',
      'attendance',
      `Tự điểm danh thành công. ${isDefaultLeader ? 'Kíp trưởng đã có mặt.' : 'Ghi nhận kíp trưởng tạm thời.'}`,
      userId,
      userId,
      slotId,
    );

    return updated;
  }

  private async checkLeadership(slot: any, performer: any) {
    const performerId = getActorId(performer);
    const isAdmin = performer.role === 'admin' || performer.role === 'staff';
    if (isAdmin) return true;

    // Check if within shift time
    const now = dayjs();
    const shiftDate = dayjs(slot.shiftDate).format('YYYY-MM-DD');
    const startTime = dayjs(`${shiftDate} ${slot.startTime}`);
    const endTime = dayjs(`${shiftDate} ${slot.endTime}`);

    if (now.isBefore(startTime) || now.isAfter(endTime)) {
      throw ApiError.forbidden('Thao tác quản lý chỉ được thực hiện trong thời gian diễn ra kíp trực.');
    }

    const assignedIds = normalizeIdList(slot.assignedUserIds || []);
    const attendedIds = normalizeIdList(slot.attendedUserIds || []);
    const defaultLeaderId = assignedIds[0];

    const isDefaultLeader =
      normalizeId(performerId) === normalizeId(defaultLeaderId) && attendedIds.includes(performerId as number);
    const isTempLeader = normalizeId(performerId) === normalizeId(slot.tempLeaderId);

    if (!isDefaultLeader && !isTempLeader) {
      throw ApiError.forbidden('Bạn không có quyền quản lý kíp trực này.');
    }

    return true;
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

    // Toggle attendance
    const targetId = normalizeId(targetUserId);
    const isAlreadyAttended = attendedIds.includes(targetId);

    let action = 'MARK';
    const newAssignedIds = [...assignedIds];

    if (isAlreadyAttended) {
      // Remove attendance
      const index = attendedIds.indexOf(targetId);
      attendedIds.splice(index, 1);
      action = 'UNMARK';

      if (slot.attendanceData && slot.attendanceData[targetId]) {
        delete slot.attendanceData[targetId];
      }
    } else {
      // Add attendance
      attendedIds.push(targetId);

      // Also add to assigned if not there (Supplementary attendance)
      if (!assignedIds.includes(targetId)) {
        newAssignedIds.push(targetId);
      }

      const attendanceData = slot.attendanceData || {};
      attendanceData[targetId] = {
        time: new Date().toISOString(),
        method: 'leader',
        markedBy: performerId,
      };
      slot.attendanceData = attendanceData;
    }

    const updated = await dutySlotsRepository.update(slotId, {
      assignedUserIds: newAssignedIds,
      attendedUserIds: attendedIds,
      attendanceData: slot.attendanceData,
      updatedAt: new Date().toISOString(),
    });

    await dutyLogsService.log(
      'attendance',
      action === 'MARK' ? 'leader' : 'leader_unmark',
      `${action === 'MARK' ? 'Ghi nhận' : 'Hủy'} điểm danh cho người dùng #${targetId} bởi #${performerId}`,
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

    await this.checkLeadership(slot, performer);

    const existingViolation = await dutyViolationsRepository.findOne({
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
    });

    const coeff = Number(coefficient) || 1;
    const penaltyAmount = coeff * 5000;
    const reason = `Vi phạm kíp trực: ${type} (Hệ số x${coeff})`;

    let violation;
    if (existingViolation) {
      // Update existing violation
      violation = await dutyViolationsRepository.update(existingViolation.id, {
        type,
        coefficient: coeff,
        note: note || '',
        updatedAt: new Date().toISOString(),
      });

      // Sync with rewardPenaltyService if penaltyId exists
      if (existingViolation.penaltyId) {
        try {
          await rewardPenaltyService.updateEntry(
            existingViolation.penaltyId,
            {
              amount: penaltyAmount,
              reason,
              note: note || '',
            },
            performerId,
          );
        } catch (err) {
          console.error('Failed to update linked penalty:', err);
        }
      } else {
        // Create new penalty if missing
        const penalty = await rewardPenaltyService.createEntry(
          {
            userId: normalizeId(userId),
            type: 'penalty',
            amount: penaltyAmount,
            reason,
            note: note || '',
            violationId: existingViolation.id,
          },
          performerId,
        );
        await dutyViolationsRepository.update(existingViolation.id, { penaltyId: penalty.id });
      }
    } else {
      // Create new violation
      violation = await dutyViolationsRepository.create({
        slotId: normalizeId(slotId),
        userId: normalizeId(userId),
        type,
        coefficient: coeff,
        note: note || '',
        createdBy: performerId,
        createdAt: new Date().toISOString(),
      });

      // Create linked penalty
      try {
        const penalty = await rewardPenaltyService.createEntry(
          {
            userId: normalizeId(userId),
            type: 'penalty',
            amount: penaltyAmount,
            reason,
            note: note || '',
            violationId: violation.id,
          },
          performerId,
        );

        // Update violation with penaltyId
        await dutyViolationsRepository.update(violation.id, { penaltyId: penalty.id });
      } catch (err) {
        console.error('Failed to create linked penalty:', err);
      }
    }

    await dutyLogsService.log(
      'violation',
      'report',
      `Ghi nhận vi phạm [${type}] cho thành viên: ${userId}. Hệ số: ${coefficient}`,
      performerId,
      userId,
      slotId,
    );

    // --- AUTOMATIC PENALTY CREATION ---
    const dateStr = dayjs(slot.shiftDate).format('YYYY-MM-DD');
    const label = await this.getSlotLabel(slot);
    const settings = await dutySettingsService.getSettings();

    let baseAmount = 0;
    let penaltyReason = '';

    if (type.toLowerCase().includes('vắng') && type.toLowerCase().includes('không phép')) {
      baseAmount = settings.penaltyAbsentNoPermission || 50000;
      penaltyReason = 'Vắng trực không phép';
    } else if (type.toLowerCase().includes('vắng') && type.toLowerCase().includes('có phép')) {
      baseAmount = settings.penaltyAbsentWithPermissionLate || 20000;
      penaltyReason = 'Vắng trực báo muộn';
    } else if (type.toLowerCase().includes('muộn')) {
      baseAmount = settings.penaltyLate || 10000;
      penaltyReason = 'Đi trực muộn';
    }

    if (baseAmount > 0) {
      await rewardPenaltyService.createEntry(
        {
          userId,
          type: 'penalty',
          amount: baseAmount * (Number(coefficient) || 1),
          reason: `${penaltyReason} (${label} ngày ${dateStr})`,
          eventDate: slot.shiftDate,
          note: `Tự động ghi nhận từ báo cáo vi phạm. Ghi chú gốc: ${note || 'Không có'}`,
        },
        performerId,
      );
    }

    return violation;
  }

  async updateActualShift(shiftId: number, data: GenericRecord) {
    const shift = await dutyShiftsRepository.findById(shiftId);
    if (!shift) throw ApiError.notFound('Ca thực tế không tồn tại');
    return await dutyShiftsRepository.update(shiftId, { ...data, updatedAt: new Date().toISOString() });
  }

  async updateActualKip(kipId: number, data: GenericRecord) {
    const kip = await dutyKipsRepository.findById(kipId);
    if (!kip) throw ApiError.notFound('Kíp thực tế không tồn tại');

    if (data.shiftId) {
      const shift = await dutyShiftsRepository.findById(data.shiftId);
      if (!shift) throw ApiError.notFound('Ca trực không tồn tại');
    }

    return await dutyKipsRepository.update(kipId, { ...data, updatedAt: new Date().toISOString() });
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
    const settings = await dutySettingsService.getSettings();
    const defaultQuota = Number(settings.defaultQuota) || 2.5;
    const quotaRules = settings.quotaRules || [];

    const [slots, leaves, swaps, violations, user] = await Promise.all([
      dutySlotsRepository.findMany({ assignedUserIds_contains: id }),
      dutyLeaveRequestsRepository.findMany({ userId: id }),
      dutySwapRequestsRepository.findMany({ requesterId: id }),
      dutyViolationsRepository.findMany({ userId: id }),
      usersRepository.findById(id) as Promise<any>,
    ]);

    // Get user's quota
    const rule = quotaRules.find(
      (r: any) =>
        (r.type === 'position' && user && r.target === user.position) ||
        (r.type === 'user' && String(r.target) === String(id)),
    );
    const userQuota = rule ? Number(rule.quota) : defaultQuota;

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

    const totalKips = slots.reduce((acc, slot) => {
      const isAttended = normalizeIdList(slot.attendedUserIds || []).includes(id);
      return acc + (isAttended ? Number(slot.coefficient) || 1 : 0);
    }, 0);

    const deficiency = Math.max(0, userQuota - totalKips);

    return {
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      totalKips,
      attendedCount,
      points,
      violationCount: violations.length,
      deficiency,
      isWarning: deficiency > 0,
      userQuota,
      pendingRequests:
        leaves.filter((r: any) => r.status === 'pending').length +
        swaps.filter((r: any) => r.status === 'pending').length,
      upcomingCount: slots.filter((s: any) => dayjs(s.shiftDate).isAfter(dayjs())).length,
      recentLogs: await dutyLogsService.getUserLogs(id, 5),
    };
  }

  async exportRangeExcel(options: any = {}) {
    const startDate = dayjs(options.startDate || options.weekStart || dayjs().startOf('isoWeek' as any)).startOf('day');
    const endDate = dayjs(options.endDate || dayjs(startDate).add(6, 'day')).endOf('day');
    const mode = options.mode || 'only_duty';
    const includeDays = options.includeDays || [1, 2, 3, 4, 5, 6, 0]; // Default to all days if not provided

    const slots = await dutySlotsRepository.findMany({
      shiftDate: {
        $gte: startDate.toISOString(),
        $lte: endDate.toISOString(),
      },
    });

    // Fetch meetings if needed
    let meetings: any[] = [];
    if (mode === 'all' || mode === 'with_meetings') {
      const meetingModule = await import('@modules/meetings/services/meeting.service');
      const mRes = await meetingModule.default.findAll({
        filter: {
          meetingAt: {
            $gte: startDate.toISOString(),
            $lte: endDate.toISOString(),
          },
        },
      });
      if (mRes.success) meetings = mRes.data;
    }

    const workbook = new ExcelJS.Workbook();

    // Group days by week for multi-week export
    const allDays: dayjs.Dayjs[] = [];
    let curr = dayjs(startDate);
    while (curr.isSameOrBefore(endDate, 'day')) {
      if (includeDays.includes(curr.day())) {
        allDays.push(curr);
      }
      curr = curr.add(1, 'day');
    }

    if (allDays.length === 0) throw new ApiError(400, 'Không có ngày nào để xuất');

    // Split into chunks of 7 days (weeks) for the template look
    const chunks: dayjs.Dayjs[][] = [];
    for (let i = 0; i < allDays.length; i += 7) {
      chunks.push(allDays.slice(i, i + 7));
    }

    // Fetch templates once to maintain order
    const { templates } = (await this.getWeeklySchedule({ weekStart: startDate.format('YYYY-MM-DD') })).data;

    // Styles
    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 14, color: { argb: 'FF000000' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC6E0B4' } }, // Light green
    };

    const dayHeaderStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 11 },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const kipLabelStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const cellStyle: Partial<ExcelJS.Style> = {
      font: { size: 10 },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const meetingCellStyle: Partial<ExcelJS.Style> = {
      font: { size: 10, italic: true, color: { argb: 'FFFF0000' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } }, // Light yellow
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const kipPalettes = [
      'FFE0F2FE', // Blue
      'FFFEF3C7', // Yellow
      'FFDCFCE7', // Green
      'FFF3E8FF', // Purple
      'FFFFEDD5', // Orange
      'FFFCE7F3', // Pink
      'FFF1F5F9', // Slate
    ];

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const weekDays = chunks[cIdx];
      const sheetName = chunks.length > 1 ? `Trang ${cIdx + 1}` : 'Lịch trực';
      const worksheet = workbook.addWorksheet(sheetName);
      const numCols = weekDays.length;

      worksheet.getColumn(1).width = 25;
      for (let i = 2; i <= numCols + 1; i++) worksheet.getColumn(i).width = 20;

      const rangeStr = `${weekDays[0].format('DD/MM')} - ${weekDays[numCols - 1].format('DD/MM')}`;
      const titleRow = worksheet.addRow([`LỊCH TRỰC TV DCD (${rangeStr})`]);
      worksheet.mergeCells(1, 1, 1, numCols + 1);
      titleRow.getCell(1).style = headerStyle;
      titleRow.height = 30;

      const dayHeaderRow = worksheet.addRow(['', ...weekDays.map((d) => d.format('dddd (DD/MM)'))]);
      dayHeaderRow.eachCell((cell, colNumber) => {
        cell.style = dayHeaderStyle;
        if (colNumber > 1) {
          const d = weekDays[colNumber - 2];
          const isWeekend = d.day() === 0 || d.day() === 6;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isWeekend ? 'FFE2EFDA' : 'FFF8D7DA' } };
        }
      });
      dayHeaderRow.height = 25;

      const scheduleMap: Record<number, Record<string, string[]>> = {};
      for (let i = 0; i < numCols; i++) scheduleMap[i] = {};

      slots.forEach((slot: any) => {
        const slotDate = dayjs(slot.shiftDate);
        const dayIdx = weekDays.findIndex((d) => d.isSame(slotDate, 'day'));
        if (dayIdx === -1) return;
        const label = slot.shiftLabel;
        if (!scheduleMap[dayIdx][label]) scheduleMap[dayIdx][label] = [];
        (slot.assignedUsers || []).forEach((u: any) => scheduleMap[dayIdx][label].push(u.name));
      });

      const dayMeetings: Record<number, any[]> = {};
      for (let i = 0; i < numCols; i++) dayMeetings[i] = [];
      meetings.forEach((m: any) => {
        const mDate = dayjs(m.meetingAt);
        const dayIdx = weekDays.findIndex((d) => d.isSame(mDate, 'day'));
        if (dayIdx === -1) return;
        dayMeetings[dayIdx].push(m);
      });

      const periodKipLabels = Array.from(
        new Set(
          slots
            .filter((s) => weekDays.some((d) => d.isSame(dayjs(s.shiftDate), 'day')))
            .map((s: any) => s.shiftLabel as string),
        ),
      ).sort();
      const orderedKips: { label: string; details: string }[] = [];
      templates.forEach((s: any) => {
        s.kips.forEach((k: any) => {
          const label = `${s.name} - ${k.name}`;
          const details = `(${k.startTime} - ${k.endTime})\n<${k.coefficient} kíp>`;
          orderedKips.push({ label, details });
        });
      });
      periodKipLabels.forEach((label) => {
        if (!orderedKips.find((ok) => ok.label === label)) orderedKips.push({ label, details: '' });
      });

      let currentRow = 3;
      let kipColorIdx = 0;
      for (const kipInfo of orderedKips) {
        const label = kipInfo.label;
        const details = kipInfo.details;
        const kipBgColor = kipPalettes[kipColorIdx % kipPalettes.length];

        let maxPeople = 1;
        for (let i = 0; i < numCols; i++)
          if ((scheduleMap[i][label]?.length || 0) > maxPeople) maxPeople = scheduleMap[i][label].length;

        const startKipRow = currentRow;
        for (let r = 0; r < maxPeople; r++) {
          const rowData = [r === 0 ? `${label}\n${details}` : ''];
          for (let i = 0; i < numCols; i++) rowData.push(scheduleMap[i][label]?.[r] || '');

          const isSubRowEven = r % 2 === 0;
          const cellBgColor = isSubRowEven ? 'FFFFFFFF' : 'FFF9FAFB';
          const row = worksheet.addRow(rowData);
          row.eachCell((cell, colNumber) => {
            if (colNumber > 1) {
              cell.style = cellStyle;
              const d = weekDays[colNumber - 2];
              const isWeekend = d.day() === 0 || d.day() === 6;
              if (isWeekend)
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: isSubRowEven ? 'FFF2F2F2' : 'FFEAEAEA' },
                };
              else cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cellBgColor } };
            } else {
              cell.style = kipLabelStyle;
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: kipBgColor } };
            }
          });
          currentRow++;
        }
        if (maxPeople > 1) worksheet.mergeCells(startKipRow, 1, currentRow - 1, 1);
        kipColorIdx++;
      }

      if (meetings.some((m) => weekDays.some((d) => d.isSame(dayjs(m.meetingAt), 'day')))) {
        worksheet.addRow([]);
        currentRow++;
        const mTitleRow = worksheet.addRow(['LỊCH HỌP / SỰ KIỆN']);
        worksheet.mergeCells(currentRow, 1, currentRow, numCols + 1);
        mTitleRow.getCell(1).style = {
          ...headerStyle,
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE599' } },
        };
        currentRow++;

        let maxMs = 0;
        for (let i = 0; i < numCols; i++) if (dayMeetings[i].length > maxMs) maxMs = dayMeetings[i].length;
        for (let r = 0; r < maxMs; r++) {
          const rowData = [''];
          for (let i = 0; i < numCols; i++) {
            const m = dayMeetings[i][r];
            rowData.push(m ? `${dayjs(m.meetingAt).format('HH:mm')}: ${m.title}` : '');
          }
          const row = worksheet.addRow(rowData);
          row.eachCell((cell, colNumber) => {
            if (colNumber > 1) cell.style = meetingCellStyle;
          });
          currentRow++;
        }
      }
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  }
}

export default new DutySlotsService();
