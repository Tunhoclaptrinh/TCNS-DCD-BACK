import { Parser } from 'json2csv';
import XLSX from 'xlsx';
import db from '@config/database';

function normalizeIdList(values = []) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((v) => Number(v)).filter((v) => !Number.isNaN(v)))];
}

class ReportService {
  async getOverview() {
    const [users, dutySlots, swapRequests, rewardPenalties, notifications] = await Promise.all([
      db.findAll('users'),
      db.findAll('duty_slots'),
      db.findAll('duty_swap_requests'),
      db.findAll('reward_penalties'),
      db.findAll('notifications'),
    ]);

    const totalUsers = users.length;
    const activeUsers = users.filter((u) => u.isActive).length;
    const expelledUsers = users.filter((u) => u.expelled).length;

    const usersByRole = {};
    for (const user of users) {
      usersByRole[user.role || 'unknown'] = (usersByRole[user.role || 'unknown'] || 0) + 1;
    }

    let totalCapacity = 0;
    let totalAssigned = 0;
    for (const slot of dutySlots) {
      totalCapacity += Math.max(1, Number(slot.capacity) || 1);
      totalAssigned += normalizeIdList(slot.assigned_user_ids || []).length;
    }

    let totalReward = 0;
    let totalPenalty = 0;
    for (const item of rewardPenalties) {
      const amount = Number(item.amount) || 0;
      if (item.type === 'reward') totalReward += amount;
      else totalPenalty += amount;
    }

    const pendingSwapRequests = swapRequests.filter((item) => item.status === 'pending').length;
    const unreadNotifications = notifications.filter((item) => item.is_read === false).length;

    const recentNotifications = [...notifications]
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      .slice(0, 10)
      .map((item) => ({
        id: item.id,
        user_id: item.user_id,
        title: item.title,
        type: item.type,
        category: item.category,
        createdAt: item.createdAt,
      }));

    return {
      generatedAt: new Date().toISOString(),
      users: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        expelledUsers,
        usersByRole,
      },
      duty: {
        totalSlots: dutySlots.length,
        totalCapacity,
        totalAssigned,
        coverageRate: totalCapacity === 0 ? 0 : Number(((totalAssigned / totalCapacity) * 100).toFixed(2)),
        pendingSwapRequests,
      },
      finance: {
        totalEntries: rewardPenalties.length,
        totalReward,
        totalPenalty,
        netBalance: totalReward - totalPenalty,
      },
      notifications: {
        totalNotifications: notifications.length,
        unreadNotifications,
      },
      recentNotifications,
    };
  }

  buildCsvBuffer(overview) {
    const summaryRow = {
      generatedAt: overview.generatedAt,
      totalUsers: overview.users.totalUsers,
      activeUsers: overview.users.activeUsers,
      expelledUsers: overview.users.expelledUsers,
      totalSlots: overview.duty.totalSlots,
      coverageRate: overview.duty.coverageRate,
      pendingSwapRequests: overview.duty.pendingSwapRequests,
      totalReward: overview.finance.totalReward,
      totalPenalty: overview.finance.totalPenalty,
      netBalance: overview.finance.netBalance,
      totalNotifications: overview.notifications.totalNotifications,
      unreadNotifications: overview.notifications.unreadNotifications,
    };

    const parser = new Parser();
    return Buffer.from(parser.parse([summaryRow]));
  }

  buildExcelBuffer(overview) {
    const workbook = XLSX.utils.book_new();

    const summaryRows = [
      {
        generatedAt: overview.generatedAt,
        totalUsers: overview.users.totalUsers,
        activeUsers: overview.users.activeUsers,
        expelledUsers: overview.users.expelledUsers,
        totalSlots: overview.duty.totalSlots,
        coverageRate: overview.duty.coverageRate,
        pendingSwapRequests: overview.duty.pendingSwapRequests,
        totalReward: overview.finance.totalReward,
        totalPenalty: overview.finance.totalPenalty,
        netBalance: overview.finance.netBalance,
        totalNotifications: overview.notifications.totalNotifications,
        unreadNotifications: overview.notifications.unreadNotifications,
      },
    ];

    const roleRows = Object.entries(overview.users.usersByRole).map(([role, count]) => ({ role, count }));

    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(roleRows), 'UsersByRole');
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.json_to_sheet(overview.recentNotifications),
      'RecentNotifications',
    );

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  }

  async exportOverview(format = 'xlsx') {
    const normalizedFormat = String(format || 'xlsx').toLowerCase();
    const overview = await this.getOverview();

    if (normalizedFormat === 'csv') {
      return {
        filename: 'admin-overview.csv',
        contentType: 'text/csv',
        buffer: this.buildCsvBuffer(overview),
      };
    }

    return {
      filename: 'admin-overview.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: this.buildExcelBuffer(overview),
    };
  }
}

export default new ReportService();
