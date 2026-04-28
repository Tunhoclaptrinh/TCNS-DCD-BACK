import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyViolationsRepository from '@modules/duty/repositories/duty-violations.repository';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import dutySettingsService from './duty-settings.service';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import { normalizeId, normalizeIdList } from './duty-utils';
import dayjs from 'dayjs';
import * as xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';

class DutyStatsService {
  async getComprehensiveStats(options: any = {}) {
    const { startDate, endDate, departmentId, generationId } = options;
    const settings = await dutySettingsService.getSettings();
    const defaultQuota = Number(settings.defaultQuota) || 2.5;
    const kipPrice = Number(settings.kipPrice) || 0;
    const penaltyRate = Number(settings.violationPenaltyRate) || 0;
    const quotaRules = settings.quotaRules || [];

    const slotFilter: any = {};
    if (startDate && endDate) {
      slotFilter.shiftDate_gte = new Date(startDate);
      slotFilter.shiftDate_lte = new Date(endDate);
    }

    // 1. Fetch all necessary data
    const [slots, violations, leaves, swaps, allUsers, allKips] = await Promise.all([
      dutySlotsRepository.findMany(slotFilter),
      dutyViolationsRepository.findAll(),
      dutyLeaveRequestsRepository.findAll(),
      dutySwapRequestsRepository.findAll(),
      usersRepository.findAll() as Promise<any[]>,
      dutyKipsRepository.findAll(),
    ]);

    const kipMap = new Map(allKips.map((k: any) => [normalizeId(k.id), k]));

    // 2. Filter users based on criteria
    const users = allUsers.filter((u) => {
      if (
        departmentId &&
        String(u.department?.id || u.department || '')
          .trim()
          .toLowerCase() !== String(departmentId).trim().toLowerCase()
      )
        return false;
      const genIdStr = String(
        typeof u.generationId === 'object' ? u.generationId?.id || u.generationId?._id : u.generationId,
      );
      if (generationId && genIdStr !== String(generationId)) return false;
      return true;
    });

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

      const start = new Date(startDate);
      const end = new Date(endDate);
      const numWeeks = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));
      const numMonths = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (30 * 24 * 60 * 60 * 1000)));

      // Find specific rule for user
      const rule = quotaRules.find((r: any) => {
        const matchTarget =
          (r.type === 'position' && r.target === user.position) ||
          (r.type === 'user' && String(r.target) === String(userId));
        if (!matchTarget) return false;

        if (r.startDate && r.endDate) {
          const ruleStart = new Date(r.startDate).getTime();
          const ruleEnd = new Date(r.endDate).getTime();
          const viewStart = start.getTime();
          const viewEnd = end.getTime();
          // The rule applies if there is an overlap
          if (viewEnd < ruleStart || viewStart > ruleEnd) return false;
        }
        return true;
      });

      let userQuota = 0;
      if (rule) {
        const ruleQuota = Number(rule.quota);
        if (rule.cycle === 'month') {
          userQuota = Number((ruleQuota * numMonths).toFixed(2));
        } else {
          userQuota = Number((ruleQuota * numWeeks).toFixed(2));
        }
      } else {
        userQuota = Number((defaultQuota * numWeeks).toFixed(2));
      }

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
        studentId: user.studentId,
        department: user.department?.name || user.department || 'N/A',
        position: user.position,
        totalKips,
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
