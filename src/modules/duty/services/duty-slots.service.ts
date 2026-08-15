import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import db from '@database/mongo-database.adapter';
import ExcelJS from 'exceljs';
import dutyDaysRepository from '@modules/duty/repositories/duty-days.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
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
  findMatchingQuotaRule,
} from './duty-utils';
import dutySettingsService from './duty-settings.service';
import dutyLogsService from './duty-logs.service';
import dutyViolationsRepository from '@modules/duty/repositories/duty-violations.repository';
import rewardPenaltyService from '@modules/reward-penalties/services/reward-penalty.service';
import dutyPeriodConfigsService from './duty-period-configs.service';

class DutySlotsService {
  async findSlotOrThrow(slotId: Identifier) {
    const slot = (await dutySlotsRepository.findById(slotId)) as DutySlotRecord | null;
    if (!slot) {
      throw ApiError.notFound('Duty slot not found');
    }
    return slot;
  }

  private async assertDayNotLocked(slot: any, performer?: any) {
    const isAdmin = performer && (performer.role === 'admin' || performer.role === 'staff');
    if (isAdmin) return;

    let dayRecord: any = null;
    if (slot.dayId) {
      dayRecord = await dutyDaysRepository.findById(slot.dayId);
    }
    if (!dayRecord) {
      try {
        const d = new Date(slot.shiftDate);
        d.setUTCHours(0, 0, 0, 0);
        dayRecord = await dutyDaysRepository.findByDate(d.toISOString());
      } catch (e) {
        dayRecord = null;
      }
    }

    if (dayRecord && dayRecord.status === 'locked') {
      throw ApiError.badRequest('Ngày đã bị khóa');
    }
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

    const [days, shifts, kips, slotsResult, users, assignments, settings] = await Promise.all([
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
      dutySettingsService.getSettings(),
    ]);

    const slotIds = slotsResult.data.map((s: any) => normalizeId(s.id));

    const [violations, leaveRequests, swapRequests] = await Promise.all([
      dutyViolationsRepository.findMany({ slotId_in: slotIds }),
      dutyLeaveRequestsRepository.findMany({ slotId_in: slotIds }),
      dutySwapRequestsRepository.findMany({ fromSlotId_in: slotIds }),
    ]);

    const userMap = new Map(users.map((user) => [normalizeId(user.id), user]));

    const isGlobalPrivacyMode = settings.isPrivacyMode === true;
    const requesterRole = options.userRole;
    const requesterId = normalizeId(options.userId);
    const isAdmin = requesterRole === 'admin' || requesterRole === 'staff';

    const slots = slotsResult.data.map((slot: any) => {
      const assignedIds = normalizeIdList(slot.assignedUserIds || []);
      const attendedIds = normalizeIdList(slot.attendedUserIds || []);
      const kip = kips.find((k: any) => normalizeId(k.id) === normalizeId(slot.kipId)) || slot.kip;
      const shiftId = slot.shiftId || kip?.shiftId || slot.kip?.shiftId;
      const shift =
        shifts.find(
          (s: any) =>
            normalizeId(s.id) === normalizeId(shiftId) || normalizeId(s.fromTemplateShiftId) === normalizeId(shiftId),
        ) || slot.shift;

      const slotVisibilityMode =
        slot.config?.visibilityMode ||
        (slot as any).kip?.config?.visibilityMode ||
        kip?.config?.visibilityMode ||
        kip?.visibilityMode ||
        (isGlobalPrivacyMode ? 'private_mutual' : 'public');

      const privacyMaskType =
        slot.config?.privacyMaskType ||
        (slot as any).kip?.config?.privacyMaskType ||
        kip?.config?.privacyMaskType ||
        'masked';

      const filterUserByPrivacy = (user: any, visibilityMode: string, maskType: string) => {
        if (!user) return null;
        if (isAdmin) return user;
        if (normalizeId(user.id) === requesterId) return user;

        const userPermissions = options.userPermissions || [];
        if (userPermissions.includes('duty:view:private') || userPermissions.includes('*')) return user;

        const p = Array.isArray(user.permissions) ? user.permissions : [];
        const uPos = String(user.position || '').toLowerCase();
        const isOfficial = uPos !== 'ctv';

        const requesterPosition = String(options.userPosition || options.fullUser?.position || '').toLowerCase();
        const reqRoleStr = String(requesterRole || '').toLowerCase();
        const isReqOfficial = requesterPosition ? requesterPosition !== 'ctv' : reqRoleStr !== 'ctv';

        let isHidden = false;
        if (visibilityMode === 'hidden_all') {
          isHidden = true;
        } else if (visibilityMode === 'private_mutual') {
          if (isReqOfficial !== isOfficial) isHidden = true;
        } else if (visibilityMode === 'protect_members') {
          if (!isReqOfficial && isOfficial) isHidden = true;
        }

        if (isHidden) {
          if (maskType === 'omitted') {
            return null; // Ẩn hoàn toàn khỏi danh sách
          }
          return {
            id: user.id,
            name: 'Thành viên',
            avatar: null,
            studentId: '********',
            position: 'Thành viên',
            isMasked: true,
          };
        }
        return user;
      };

      const assignedUsers = assignedIds
        .map((id) => filterUserByPrivacy(userMap.get(id), slotVisibilityMode, privacyMaskType))
        .filter(Boolean);
      const attendedUsers = attendedIds
        .map((id) => filterUserByPrivacy(userMap.get(id), slotVisibilityMode, privacyMaskType))
        .filter(Boolean);

      const slotStartTime = slot.startTime || kip?.startTime || shift?.startTime || '00:00';
      const slotEndTime = slot.endTime || kip?.endTime || shift?.endTime || '00:00';

      let resolvedShiftLabel = '';
      if (shift && kip) {
        resolvedShiftLabel = `${shift.name} - ${kip.name}`;
      } else if (slot.shift && slot.kip) {
        resolvedShiftLabel = `${slot.shift.name} - ${slot.kip.name}`;
      } else if (slot.shiftLabel && slot.shiftLabel.includes(' - ')) {
        resolvedShiftLabel = slot.shiftLabel;
      } else if (kip) {
        const shiftPrefix = slotStartTime < '12:00' ? 'Sáng' : slotStartTime < '18:00' ? 'Ca chiều' : 'Ca tối';
        resolvedShiftLabel = `${shiftPrefix} - ${kip.name}`;
      } else if (shift) {
        resolvedShiftLabel = `${shift.name} - Toàn ca`;
      } else {
        resolvedShiftLabel = slot.shiftLabel || 'Kíp trực';
      }

      const slotCoefficient = Number(slot.coefficient ?? kip?.coefficient ?? shift?.coefficient ?? 1);
      const slotCapacity = Number(slot.capacity ?? kip?.capacity ?? shift?.capacity ?? 1);

      return {
        ...slot,
        shiftLabel: resolvedShiftLabel,
        startTime: slotStartTime,
        endTime: slotEndTime,
        coefficient: slotCoefficient,
        capacity: slotCapacity,
        attendanceOverrides: slot.attendanceOverrides || {},
        kip: kip ? { ...kip, coefficient: Number(kip.coefficient || 1) } : slot.kip,
        shift: shift ? { ...shift, coefficient: Number(shift.coefficient || 1) } : slot.shift,
        assignedUsers,
        attendedUsers,
        totalRegistered: assignedIds.length,
        registeredCount: assignedIds.length,
        isFull: assignedIds.length >= slotCapacity,
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
          const defaultGroup = templateData.find((g: any) => g.isDefault);
          const defaultQuota =
            periodConfig.defaultQuota !== undefined && periodConfig.defaultQuota !== null
              ? Number(periodConfig.defaultQuota)
              : Number(settings.defaultQuota ?? (defaultGroup?.defaultQuota || 2.5));
          const quotaRules = periodConfig.quotaRules || settings.quotaRules || defaultGroup?.quotaRules || [];
          const pos = String(fullUser.position || '').toLowerCase();
          const uDept = String(fullUser.department?.name || fullUser.department || '').trim();

          const getRoleGroup = (user: any) => {
            const p = Array.isArray(user.permissions) ? user.permissions : [];
            const position = String(user.position || '').toLowerCase();

            // Collaborators
            if (position === 'ctv') return 'ctv';

            // Official members (admin, manager, leader, member or any other active role)
            return 'member_official';
          };
          const roleGroup = getRoleGroup(fullUser);

          const rule = findMatchingQuotaRule(fullUser, quotaRules, {
            startDate: ws.toISOString(),
            endDate: we.toISOString(),
          });
          weeklyQuota = rule ? Number(rule.quota) : defaultQuota;
          const cycle = rule?.cycle || 'week';
          let registeredKips = 0;

          if (cycle === 'month') {
            const targetDate = options.startDate || options.weekStart || weekStart;
            const startOfMonth = dayjs(targetDate).startOf('month').toISOString();
            const endOfMonth = dayjs(targetDate).endOf('month').toISOString();

            const allSlotsInMonth = await dutySlotsRepository.findMany({
              shiftDate_gte: startOfMonth,
              shiftDate_lte: endOfMonth,
            });

            const userSlotsInMonth = allSlotsInMonth.filter((s: any) =>
              normalizeIdList(s.assignedUserIds || []).includes(userId),
            );

            registeredKips = userSlotsInMonth.reduce((acc: number, s: any) => {
              const customCoeff = s.attendanceOverrides?.[String(userId)];
              if (customCoeff !== undefined && customCoeff !== null && !isNaN(Number(customCoeff))) {
                return acc + Number(customCoeff);
              }
              const kip = kips.find((k: any) => normalizeId(k.id) === normalizeId(s.kipId));
              return acc + Number(s.coefficient ?? kip?.coefficient ?? 1);
            }, 0);
          } else {
            const userSlotsInWeek = slots.filter((s: any) => normalizeIdList(s.assignedUserIds || []).includes(userId));
            registeredKips = userSlotsInWeek.reduce((acc: number, s: any) => {
              const customCoeff = s.attendanceOverrides?.[String(userId)];
              if (customCoeff !== undefined && customCoeff !== null && !isNaN(Number(customCoeff))) {
                return acc + Number(customCoeff);
              }
              const kip = kips.find((k: any) => normalizeId(k.id) === normalizeId(s.kipId));
              return acc + Number(s.coefficient ?? kip?.coefficient ?? 1);
            }, 0);
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
    const performer = user as any;
    await this.assertDayNotLocked(slot, performer);
    if (slot.status === 'locked') throw ApiError.badRequest('Locked');

    const userId = getActorId(user);
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
      const defaultGroup = await dutyTemplatesRepository.findDefault();
      const defaultQuota = Number(
        periodConfig.defaultQuota ?? settings.defaultQuota ?? (defaultGroup?.defaultQuota || 2.5),
      );
      const quotaRules = periodConfig.quotaRules || settings.quotaRules || defaultGroup?.quotaRules || [];
      const pos = String(fullUser.position || '').toLowerCase();
      const uDept = String(fullUser.department?.name || fullUser.department || '').trim();

      const getRoleGroup = (u: any) => {
        const role = String(u.role || '').toLowerCase();
        const position = String(u.position || '').toLowerCase();
        if (role === 'ctv' || position === 'ctv') return 'ctv';
        return 'member_official';
      };
      const roleGroup = getRoleGroup(fullUser);

      rule = findMatchingQuotaRule(fullUser, quotaRules, { startDate: slot.shiftDate, endDate: slot.shiftDate });
      // Yêu cầu: Không cho đăng ký dư, giới hạn đúng bằng định mức tối thiểu
      const baseQuota = rule ? Number(rule.quota) : defaultQuota;
      weeklyLimit = baseQuota > 0 ? baseQuota : 0;
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
        const startOfWeek = dayjs(slot.shiftDate).startOf('isoWeek').toISOString();
        const endOfWeek = dayjs(slot.shiftDate).endOf('isoWeek').toISOString();
        const allSlotsInWeek = await dutySlotsRepository.findMany({
          shiftDate_gte: startOfWeek,
          shiftDate_lte: endOfWeek,
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
      const fullUser = (await usersRepository.findById(userId)) || (typeof user === 'object' ? user : null);
      if (!fullUser) throw ApiError.notFound('Người dùng không tồn tại');

      const matchesUser = (posList: string[] = [], u: any, label?: string) => {
        if (!u) return false;
        const targetPos = String(u.position || '')
          .toLowerCase()
          .trim();
        const targetRole = String(u.role || '')
          .toLowerCase()
          .trim();
        const isUserCTV =
          targetPos === 'ctv' ||
          targetRole === 'ctv' ||
          targetPos.includes('cộng tác viên') ||
          targetRole.includes('cộng tác viên');
        const isUserMember = !isUserCTV;

        // 1. Direct match by label
        const labelLower = String(label || '')
          .toLowerCase()
          .trim();
        if (
          isUserCTV &&
          (labelLower === 'ctv' ||
            labelLower.includes('cộng tác viên') ||
            labelLower.includes('ctv') ||
            labelLower === 'ctc')
        )
          return true;
        if (
          isUserMember &&
          (labelLower === 'tv' ||
            labelLower === 'thành viên' ||
            labelLower.includes('thành viên') ||
            labelLower === 'tvb' ||
            labelLower === 'member')
        )
          return true;

        if (!Array.isArray(posList)) return false;

        // 2. Match by positions array
        return posList.some((p) => {
          const pLower = String(p).toLowerCase().trim();
          if (pLower === targetPos || pLower === targetRole) return true;
          if (pLower === 'dt' && (targetPos === 'dt' || targetPos.includes('đội trưởng'))) return true;
          if (pLower === 'tb' && (targetPos === 'tb' || targetPos.includes('trưởng ban'))) return true;
          if (pLower === 'pb' && (targetPos === 'pb' || targetPos.includes('phó ban'))) return true;
          if ((pLower === 'ctv' || pLower === 'ctc' || pLower.includes('cộng tác viên')) && isUserCTV) return true;
          if (
            (pLower === 'tv' || pLower === 'tvb' || pLower === 'member_all' || pLower === 'member_official') &&
            isUserMember
          )
            return true;
          return false;
        });
      };

      const requirement = slotStructure.find((req: any) => matchesUser(req.positions, fullUser, req.label));

      const allUsers = (await usersRepository.findAll()) as any[];
      const assignedUserMap = new Map(allUsers.map((u) => [normalizeId(u.id), u]));
      const assignedUsers = assigned.map((id) => assignedUserMap.get(id)).filter(Boolean);

      if (requirement) {
        const occupantsInGroup = assignedUsers.filter((u: any) =>
          matchesUser(requirement.positions, u, requirement.label),
        ).length;
        if (occupantsInGroup >= requirement.slots && !isAdmin)
          throw ApiError.badRequest(`Hết chỗ cho vị trí '${requirement.label}' (${requirement.slots} slot).`);
      } else {
        const totalStructuredSlots = slotStructure.reduce((acc: number, req: any) => acc + (Number(req.slots) || 0), 0);
        const freeSlotsTotal = maxCapacity - totalStructuredSlots;
        const structuredUserIds = new Set();
        slotStructure.forEach((req: any) => {
          assignedUsers.forEach((u: any) => {
            if (matchesUser(req.positions, u, req.label)) structuredUserIds.add(normalizeId(u.id));
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
    await this.assertDayNotLocked(slot, user);
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

  async markAttendance(
    slotId: Identifier,
    userIds: Identifier[],
    performer: any,
    isIncremental: boolean = false,
    attendanceOverrides?: Record<string, number>,
  ) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Slot not found');

    // Leadership check
    await this.assertDayNotLocked(slot, performer);
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
      newAssigned = Array.from(new Set([...currentAssigned, ...incomingIds]));
    }

    const patch: any = {
      assignedUserIds: newAssigned,
      attendedUserIds: newAttended,
      updatedAt: new Date().toISOString(),
    };

    if (attendanceOverrides && typeof attendanceOverrides === 'object') {
      patch.attendanceOverrides = {
        ...(slot.attendanceOverrides || {}),
        ...attendanceOverrides,
      };
    }

    const updated = await dutySlotsRepository.update(slotId, patch);

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

    await this.assertDayNotLocked(slot, user);

    const userId = getActorId(user);
    const assignedIds = normalizeIdList(slot.assignedUserIds || []);
    if (!assignedIds.includes(userId as number)) {
      throw ApiError.badRequest('Bạn không có lịch trực trong kíp này');
    }

    // 1. Check IP (Check system_settings first, fallback to duty_settings)
    let allowedIpRanges: string[] = [];
    const SystemSettingModel = (db as any).getModel('system_settings');
    if (SystemSettingModel) {
      const ipDoc = await SystemSettingModel.findOne({ key: 'ALLOWED_IP_RANGES' }).lean();
      if (ipDoc && ipDoc.value) {
        allowedIpRanges = String(ipDoc.value)
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
      }
    }
    if (allowedIpRanges.length === 0) {
      const settings = await dutySettingsService.getSettings();
      allowedIpRanges = Array.isArray(settings.allowedIpRanges)
        ? settings.allowedIpRanges
        : typeof settings.allowedIpRanges === 'string'
          ? (settings.allowedIpRanges as string)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
    }

    if (allowedIpRanges.length > 0 && !isIpAllowed(ip, allowedIpRanges)) {
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

  async leaderMarkAttendance(slotId: Identifier, targetUserId: Identifier, performer: any, customCoefficient?: number) {
    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp không tồn tại');
    await this.assertDayNotLocked(slot, performer);

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
    const attendanceOverrides = { ...(slot.attendanceOverrides || {}) };

    if (isAlreadyAttended) {
      // Remove attendance
      const index = attendedIds.indexOf(targetId);
      attendedIds.splice(index, 1);
      action = 'UNMARK';

      if (slot.attendanceData && slot.attendanceData[targetId]) {
        delete slot.attendanceData[targetId];
      }
      delete attendanceOverrides[String(targetId)];
    } else {
      // Add attendance
      attendedIds.push(targetId);

      // Also add to assigned if not there (Supplementary attendance)
      if (!assignedIds.includes(targetId)) {
        newAssignedIds.push(targetId);
      }

      if (customCoefficient !== undefined && customCoefficient !== null && !isNaN(Number(customCoefficient))) {
        attendanceOverrides[String(targetId)] = Number(customCoefficient);
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
      attendanceOverrides,
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
    await this.assertDayNotLocked(slot, performer);
    await this.checkLeadership(slot, performer);

    const existingViolation = await dutyViolationsRepository.findOne({
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
    });

    const coeff = Number(coefficient) || 1;

    // Fetch configuration to determine dynamic penalty
    const periodConfig = await dutyPeriodConfigsService.getConfig(slot.shiftDate, slot.shiftDate);
    const user = await usersRepository.findById(userId);
    const pos = String(user?.position || '').toLowerCase();
    const role = String(user?.role || '').toLowerCase();
    const uDept = String(user?.department?.name || user?.department || '').trim();

    const rule = findMatchingQuotaRule(user, periodConfig.quotaRules || [], {
      startDate: slot.shiftDate,
      endDate: slot.shiftDate,
    });
    const settings = await dutySettingsService.getSettings();

    // Map violation type to config field
    const typeLower = String(type).toLowerCase();
    let specificPenaltyAmount = null;

    const pConfig = periodConfig as any;
    if (typeLower.includes('vắng') && typeLower.includes('không phép')) {
      specificPenaltyAmount =
        rule?.penaltyAbsentNoPermission ?? pConfig.penaltyAbsentNoPermission ?? settings.penaltyAbsentNoPermission;
    } else if (typeLower.includes('đi muộn') || typeLower.includes('muộn')) {
      specificPenaltyAmount = rule?.penaltyLate ?? pConfig.penaltyLate ?? settings.penaltyLate;
    } else if (typeLower.includes('báo muộn')) {
      specificPenaltyAmount =
        rule?.penaltyAbsentWithPermissionLate ??
        pConfig.penaltyAbsentWithPermissionLate ??
        settings.penaltyAbsentWithPermissionLate;
    }

    const penaltyRate =
      rule?.violationPenaltyRate ?? pConfig.violationPenaltyRate ?? (Number(settings.violationPenaltyRate) || 0);
    const kipPrice = rule?.kipPrice ?? pConfig.kipPrice ?? (Number(settings.kipPrice) || 0);

    // Calculation logic: If specific amount exists, use it * coeff. Else use kipPrice * penaltyRate * coeff.
    const penaltyAmount =
      specificPenaltyAmount !== null && specificPenaltyAmount !== undefined
        ? Number(specificPenaltyAmount) * coeff
        : kipPrice * penaltyRate * coeff;

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

    // Fetch meetings if needed
    let meetings: any[] = [];
    if (mode === 'all' || mode === 'with_meetings') {
      const meetingModule = await import('@modules/meetings/services/meeting.service');
      const mRes = await meetingModule.default.listMeetings(
        options.fullUser || {
          id: options.userId,
          role: options.userRole,
          permissions: options.userPermissions,
        },
        {
          filter: {
            meetingAt_gte: startDate.toISOString(),
            meetingAt_lte: endDate.toISOString(),
          },
        },
      );
      if (mRes && mRes.data) meetings = mRes.data;
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

    // Group days by ISO calendar week so each sheet accurately corresponds to 1 week
    const weekMap = new Map<string, dayjs.Dayjs[]>();
    allDays.forEach((d) => {
      const weekKey = d.startOf('isoWeek' as any).format('YYYY-MM-DD');
      if (!weekMap.has(weekKey)) {
        weekMap.set(weekKey, []);
      }
      weekMap.get(weekKey)!.push(d);
    });

    const chunks = Array.from(weekMap.values());

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
      font: { size: 10, color: { argb: 'FF000000' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      border: {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      },
    };

    const meetingCellStyle: Partial<ExcelJS.Style> = {
      font: { size: 10, color: { argb: 'FF4338CA' }, bold: true },
      alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F3FF' } },
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
      const memberFilter = options.memberFilter || 'all'; // 'all' | 'tv' | 'ctv'

      let titlePrefix = 'LỊCH TRỰC DCD';
      if (memberFilter === 'tv') titlePrefix = 'LỊCH TRỰC THÀNH VIÊN DCD';
      else if (memberFilter === 'ctv') titlePrefix = 'LỊCH TRỰC CTV DCD';
      else titlePrefix = 'LỊCH TRỰC TV & CTV DCD';

      const titleRow = worksheet.addRow([`${titlePrefix} (${rangeStr})`]);
      worksheet.mergeCells(1, 1, 1, numCols + 1);
      titleRow.getCell(1).style = headerStyle;
      titleRow.height = 30;

      const VI_DAY_NAMES = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
      const dayHeaderRow = worksheet.addRow([
        '',
        ...weekDays.map((d) => `${VI_DAY_NAMES[d.day()]} (${d.format('DD/MM')})`),
      ]);
      dayHeaderRow.eachCell((cell, colNumber) => {
        cell.style = dayHeaderStyle;
        if (colNumber > 1) {
          const d = weekDays[colNumber - 2];
          const isWeekend = d.day() === 0 || d.day() === 6;
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isWeekend ? 'FFFCE4D6' : 'FFD9E1F2' },
          };
          cell.font = { bold: true, size: 10, color: { argb: isWeekend ? 'FFC00000' : 'FF1F4E79' } };
        }
      });
      dayHeaderRow.height = 25;

      const weekStartStr = weekDays[0].startOf('isoWeek' as any).format('YYYY-MM-DD');
      const scheduleRes = await this.getWeeklySchedule({
        weekStart: weekStartStr,
        userId: options.userId,
        userRole: options.userRole,
        userPosition: options.userPosition,
        userPermissions: options.userPermissions,
        fullUser: options.fullUser,
      });

      const weekSlots = scheduleRes.data.slots || [];
      const weekTemplates = scheduleRes.data.templates || [];

      const scheduleMap: Record<number, Record<string, string[]>> = {};
      for (let i = 0; i < numCols; i++) scheduleMap[i] = {};

      weekSlots.forEach((slot: any) => {
        const slotDate = dayjs(slot.shiftDate);
        const dayIdx = weekDays.findIndex((d) => d.isSame(slotDate, 'day'));
        if (dayIdx === -1) return;
        const label = slot.shiftLabel;
        if (!label) return;
        if (!scheduleMap[dayIdx][label]) scheduleMap[dayIdx][label] = [];

        (slot.assignedUsers || []).forEach((u: any) => {
          if (!u) return;

          const uPos = String(u.position || '').toLowerCase();
          const isCTV = uPos === 'ctv';

          if (memberFilter === 'tv' && isCTV) return;
          if (memberFilter === 'ctv' && !isCTV) return;

          let displayName = u.name || u.studentId || 'N/A';
          if (displayName !== 'Thành viên') {
            displayName = `${displayName} (${isCTV ? 'CTV' : 'TV'})`;
          }
          scheduleMap[dayIdx][label].push(displayName);
        });
      });

      const dayMeetings: Record<number, any[]> = {};
      for (let i = 0; i < numCols; i++) dayMeetings[i] = [];
      meetings.forEach((m: any) => {
        const mDate = dayjs(m.meetingAt);
        const dayIdx = weekDays.findIndex((d) => d.isSame(mDate, 'day'));
        if (dayIdx === -1) return;
        dayMeetings[dayIdx].push(m);
      });

      const kipMap = new Map<string, { label: string; details: string; order: number }>();

      // 1. Build definitions from weekTemplates
      weekTemplates.forEach((s: any, sIdx: number) => {
        (s.kips || []).forEach((k: any, kIdx: number) => {
          const label = `${s.name} - ${k.name}`;
          const timeStr = k.startTime && k.endTime ? `(${k.startTime.slice(0, 5)} - ${k.endTime.slice(0, 5)})` : '';
          const coeffStr = k.coefficient ? `<${k.coefficient} kíp>` : '';
          const details = [timeStr, coeffStr].filter(Boolean).join('\n');
          const timeVal = (k.startTime || '00:00').replace(':', '');
          if (!kipMap.has(label)) {
            kipMap.set(label, {
              label,
              details,
              order: parseInt(timeVal, 10) * 100 + (s.order ?? sIdx) * 10 + (k.order ?? kIdx),
            });
          }
        });
      });

      // 2. Ensure any slot from actual weekSlots is included
      weekSlots.forEach((slot: any) => {
        const label = slot.shiftLabel;
        if (!label) return;
        const timeStr =
          slot.startTime && slot.endTime ? `(${slot.startTime.slice(0, 5)} - ${slot.endTime.slice(0, 5)})` : '';
        const coeffStr = slot.kip?.coefficient ? `<${slot.kip.coefficient} kíp>` : '';
        const details = [timeStr, coeffStr].filter(Boolean).join('\n');
        const timeVal = (slot.startTime || '00:00').replace(':', '');
        if (!kipMap.has(label)) {
          kipMap.set(label, {
            label,
            details,
            order: parseInt(timeVal, 10) * 100 + 50,
          });
        } else if (!kipMap.get(label)!.details && details) {
          kipMap.get(label)!.details = details;
        }
      });

      const orderedKips = Array.from(kipMap.values()).sort((a, b) => a.order - b.order);

      let currentRow = 3;
      let kipColorIdx = 0;
      for (const kipInfo of orderedKips) {
        const label = kipInfo.label || 'Ca không tên';
        const details = kipInfo.details || '';
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
              const dayIdx = colNumber - 2;
              const hasSlotForDay = weekSlots.some(
                (s: any) => dayjs(s.shiftDate).isSame(d, 'day') && s.shiftLabel === label,
              );
              const hasPeopleInSlot = (scheduleMap[dayIdx][label]?.length || 0) > 0;

              if (!hasSlotForDay && !hasPeopleInSlot) {
                // Ô KHÔNG CÓ KÍP TRỰC: Bôi màu xám đậm rõ ràng + Dấu X
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFD1D5DB' },
                };
                if (!rowData[colNumber - 1]) {
                  cell.value = '✕';
                  cell.font = { bold: true, size: 12, color: { argb: 'FF6B7280' } };
                  cell.alignment = { horizontal: 'center', vertical: 'middle' };
                }
              } else if (isWeekend) {
                // Kíp trực cuối tuần
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: isSubRowEven ? 'FFFFF2CC' : 'FFFFF9E6' },
                };
                cell.font = { size: 10, color: { argb: 'FF000000' } };
              } else {
                // Kíp trực ngày thường thực tế
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: cellBgColor },
                };
                cell.font = { size: 10, color: { argb: 'FF000000' } };
              }
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
