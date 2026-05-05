import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyViolationsRepository from '@modules/duty/repositories/duty-violations.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import dutySettingsService from './duty-settings.service';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import generationsRepository from '@modules/generations/repositories/generations.repository';
import dutyPeriodConfigsService from './duty-period-configs.service';
import { normalizeId, normalizeIdList } from './duty-utils';
import dayjs from 'dayjs';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

class DutyStatsService {
  async getComprehensiveStats(options: any = {}) {
    // Extract filters from req.parsedQuery structure or directly
    const filter = options.filter || options;
    const { startDate, endDate, departmentId, generationId } = filter;

    const periodConfig = await dutyPeriodConfigsService.getConfig(startDate, endDate);
    const settings = await dutySettingsService.getSettings();

    // Prioritize period-specific config strictly. If uninitialized, fallback to baseline 0 or 2.5
    const defaultQuota =
      periodConfig.defaultQuota !== undefined && periodConfig.defaultQuota !== null
        ? Number(periodConfig.defaultQuota)
        : 0;
    const kipPrice = Number(periodConfig.kipPrice) || 0;
    const penaltyRate = Number(periodConfig.violationPenaltyRate) || 0;
    const quotaRules = periodConfig.quotaRules || [];
    const isPeriodInitialized = !!periodConfig.isInitialized;

    const slotFilter: any = {};
    if (startDate && endDate) {
      slotFilter.shiftDate_gte = new Date(startDate);
      slotFilter.shiftDate_lte = new Date(endDate);
    }

    // 1. Fetch all necessary data
    const [_slots, violations, leaves, swaps, _allUsers, _allKips, _allShifts] = await Promise.all([
      dutySlotsRepository.findMany(slotFilter),
      dutyViolationsRepository.findAll(),
      dutyLeaveRequestsRepository.findAll(),
      dutySwapRequestsRepository.findAll(),
      usersRepository.findAll() as Promise<any[]>,
      dutyKipsRepository.findAll(),
      dutyShiftsRepository.findAll(),
    ]);

    const slots = _slots as any[];
    const allUsers = _allUsers as any[];
    const allKips = _allKips as any[];
    const allShifts = _allShifts as any[];

    // Deduplicate users by studentId or id
    const uniqueUsers = Array.from(new Map(allUsers.map((u) => [u.studentId || u.id || u._id, u])).values());

    const shiftMap = new Map(allShifts.map((s: any) => [normalizeId(s.id), s]));
    const kipMap = new Map(allKips.map((k: any) => [normalizeId(k.id), k]));

    // 2. Filter users based on criteria
    // Helper to determine role group
    const getRoleGroup = (u: any) => {
      const role = String(u.role || '').toLowerCase();
      const position = String(u.position || '').toLowerCase();

      // Collaborators
      if (role === 'ctv' || position === 'ctv') return 'ctv';

      // Official members
      return 'member_official';
    };

    const activeGenerationIds =
      generationId === 'active'
        ? (await generationsRepository.findMany({ isActive: true })).map((g) => String(g._id || g.id))
        : [];

    const users = uniqueUsers.filter((u) => {
      // Robustly get department name
      const deptValue = u.department?.name || u.department;
      const uDept = String(deptValue || '').trim();

      if (departmentId && departmentId !== 'undefined' && departmentId !== 'null') {
        if (uDept.toLowerCase() !== String(departmentId).trim().toLowerCase()) {
          return false;
        }
      }

      // Robustly get generation ID
      const genRaw = u.generationId;
      const uGen = genRaw ? String(genRaw._id || genRaw.id || genRaw).trim() : null;

      if (generationId === 'active') {
        if (!uGen || !activeGenerationIds.includes(uGen)) return false;
      } else if (generationId && generationId !== 'undefined' && generationId !== 'null') {
        const targetGenId = String(generationId).trim();
        if (uGen !== targetGenId) return false;
      }

      return true;
    });

    console.log(`[DutyStats] Filter params:`, { departmentId, generationId });
    console.log(`[DutyStats] Total unique users: ${uniqueUsers.length}, Filtered: ${users.length}`);

    // 3. Calculate number of weeks for quota scaling
    let numWeeks = 1;
    if (startDate && endDate) {
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const diffDays = end.diff(start, 'day') + 1;
      numWeeks = Math.max(1, diffDays / 7);
    }

    // 4. Process stats for each user
    const stats = users.map((user) => {
      const userId = normalizeId(user.id);
      const start = dayjs(startDate);
      const end = dayjs(endDate);
      const roleGroup = getRoleGroup(user);
      const deptValue = user.department?.name || user.department;
      const uDept = String(deptValue || '').trim();

      // Priority: 1. Specific User -> 2. Dept + Role Group -> 3. Role Group (All Depts) -> 4. Default
      const findMatchingRule = () => {
        const pos = String(user.position || '').toLowerCase();

        // 1. Specific User Rule (Highest Priority)
        const userRule = quotaRules.find(
          (r: any) =>
            r.type === 'user' &&
            String(r.target) === String(user.studentId || userId) &&
            (!r.startDate || !r.endDate || (dayjs(r.startDate).isBefore(end) && dayjs(r.endDate).isAfter(start))),
        );
        if (userRule) return userRule;

        // 2. Position Rule
        const posRule = quotaRules.find(
          (r: any) =>
            r.type === 'position' &&
            String(r.target) === pos &&
            (!r.startDate || !r.endDate || (dayjs(r.startDate).isBefore(end) && dayjs(r.endDate).isAfter(start))),
        );
        if (posRule) return posRule;

        // 3. Role Group Rule
        const rgRule = quotaRules.find(
          (r: any) =>
            r.type === 'role_group' &&
            r.target === roleGroup &&
            (!r.startDate || !r.endDate || (dayjs(r.startDate).isBefore(end) && dayjs(r.endDate).isAfter(start))),
        );
        if (rgRule) return rgRule;

        return null;
      };

      const matchedRule = findMatchingRule();
      const baseQuota = matchedRule ? Number(matchedRule.quota) : defaultQuota;
      const cycle = matchedRule?.cycle || 'week';

      let userQuota = baseQuota;
      const diffDays = end.diff(start, 'day') + 1;

      if (cycle === 'week') {
        userQuota = (baseQuota * diffDays) / 7;
      } else if (cycle === 'month') {
        userQuota = (baseQuota * diffDays) / 30;
      }

      userQuota = Math.round(userQuota * 10) / 10;

      // Slots where user was assigned
      const userSlots = slots.filter((s: any) => normalizeIdList(s.assignedUserIds || []).includes(userId));

      // Slots where user actually attended
      const attendedSlots = userSlots.filter((s: any) => normalizeIdList(s.attendedUserIds || []).includes(userId));

      // Violations within period
      const userViolations = violations.filter(
        (v: any) =>
          normalizeId(v.userId) === userId &&
          (!startDate || (v.createdAt && dayjs(v.createdAt).isAfter(dayjs(startDate).subtract(1, 'second')))) &&
          (!endDate || (v.createdAt && dayjs(v.createdAt).isBefore(dayjs(endDate).add(1, 'second')))),
      );

      // Approved leaves
      const userLeaves = leaves.filter(
        (l: any) =>
          normalizeId(l.userId) === userId &&
          l.status === 'approved' &&
          userSlots.some((s) => normalizeId(s.id) === normalizeId(l.slotId)),
      );

      // Approved swaps (as requester)
      const userSwaps = swaps.filter(
        (s: any) =>
          normalizeId(s.userId) === userId &&
          s.status === 'approved' &&
          userSlots.some((slot) => normalizeId(slot.id) === normalizeId(s.fromSlotId)),
      );

      // Calculate total kips based on registered slots (userSlots) instead of attendedSlots
      const totalKips = userSlots.reduce((acc, s) => {
        const kip = kipMap.get(normalizeId(s.kipId));
        return acc + (Number(kip?.coefficient) || 1);
      }, 0);

      const violationCount = userViolations.length;
      const totalPenaltyCoeff = userViolations.reduce((acc, v) => acc + (Number(v.coefficient) || 1), 0);

      const deficiency = Math.max(0, userQuota - totalKips);
      const isWarning = totalKips < userQuota;

      const totalEarnings = totalKips * kipPrice;
      const totalPenaltyAmount = totalPenaltyCoeff * penaltyRate;
      const finalAmount = Math.max(0, totalEarnings - totalPenaltyAmount);

      return {
        userId,
        name: user.name || `${user.lastName || ''} ${user.firstName || ''}`.trim(),
        firstName: user.firstName,
        lastName: user.lastName,
        studentId: user.studentId,
        department: user.department?.name || user.department || 'N/A',
        position: user.position,
        totalKips,
        userQuota,
        violationCount,
        penaltyCoefficient: totalPenaltyCoeff,
        deficiency,
        isWarning,
        totalEarnings,
        totalPenaltyAmount,
        finalAmount,
        leaveCount: userLeaves.length,
        swapCount: userSwaps.length,
        attendanceRate: userSlots.length > 0 ? (attendedSlots.length / userSlots.length) * 100 : 0,
        violations: userViolations.map((v) => ({
          type: v.type,
          coefficient: v.coefficient,
          note: v.note,
          createdAt: v.createdAt,
        })),
      };
    });

    // 5. Generate Summary
    const summary = {
      totalKips: stats.reduce((acc, s) => acc + s.totalKips, 0),
      totalViolations: stats.reduce((acc, s) => acc + s.violationCount, 0),
      warningCount: stats.filter((s) => s.isWarning).length,
      totalPayout: stats.reduce((acc, s) => acc + s.finalAmount, 0),
      averageAttendanceRate: stats.length > 0 ? stats.reduce((acc, s) => acc + s.attendanceRate, 0) / stats.length : 0,
      violationTypes: stats.reduce((acc: any, s) => {
        s.violations.forEach((v) => {
          acc[v.type] = (acc[v.type] || 0) + 1;
        });
        return acc;
      }, {}),
    };

    return {
      success: true,
      data: {
        summary,
        details: stats,
        period: {
          startDate,
          endDate,
          numWeeks,
        },
        meta: {
          isPeriodInitialized,
          periodText: `${dayjs(startDate).format('DD/MM')} - ${dayjs(endDate).format('DD/MM/YYYY')}`,
          slots: slots.map((s) => ({
            id: s.id,
            date: s.shiftDate,
            kipId: s.kipId,
            assignedUserIds: normalizeIdList(s.assignedUserIds || []),
            attendedUserIds: normalizeIdList(s.attendedUserIds || []),
          })),
          kips: Array.from(new Map(allKips.map((k) => [normalizeId(k.id), k])).values()).map((k: any) => {
            const shift = shiftMap.get(normalizeId(k.shiftId));
            return {
              id: normalizeId(k.id),
              name: k.name,
              shiftName: shift ? shift.name : '',
              coefficient: k.coefficient,
            };
          }),
          departments: Array.from(
            new Set(uniqueUsers.map((u) => String(u.department?.name || u.department || '').trim()).filter(Boolean)),
          ).sort(),
          positions: Array.from(new Set(uniqueUsers.map((u) => u.position).filter(Boolean))).sort(),
          generations: (await generationsRepository.findAll())
            .map((g) => ({
              id: g.id || g._id,
              name: g.name,
            }))
            .sort((a, b) => String(b.name).localeCompare(String(a.name))),
        },
      },
    };
  }

  async exportStats(options: any = {}) {
    const statsResult = await this.getComprehensiveStats(options);
    const { details } = statsResult.data;

    // Prepare data for Excel
    const excelData = details.map((s, index) => ({
      STT: index + 1,
      MSV: s.studentId,
      'Họ tên': s.name,
      Ban: s.department,
      'Chức vụ': s.position,
      'Số kíp': s.totalKips,
      'Vi phạm': s.violationCount,
      'Số lần đổi ca': s.swapCount,
      'Số kíp thiếu': s.deficiency,
      'Tình trạng': s.isWarning ? 'Thiếu kíp' : 'Đủ kíp',
      'Tạm tính (VNĐ)': s.finalAmount,
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelData);

    // Styling (simplified since xlsx community edition has limited styling)
    xlsx.utils.book_append_sheet(wb, ws, 'Thong Ke Truc Ca');

    const fileName = `BaoCaoTrực_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    const uploadDir = path.resolve(process.cwd(), 'src/database/uploads');

    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, fileName);
    xlsx.writeFile(wb, filePath);

    return {
      success: true,
      url: `/uploads/${fileName}`,
      fileName,
    };
  }
}

export default new DutyStatsService();
