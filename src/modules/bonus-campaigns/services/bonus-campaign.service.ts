import XLSX from 'xlsx';
import BaseService from '@shared/common/base-service';
import bonusCampaignsRepository from '@modules/bonus-campaigns/repositories/bonus-campaigns.repository';
import semestersRepository from '@modules/semesters/repositories/semesters.repository';
import bonusRegistrationService from '@modules/bonus-registrations/services/bonus-registration.service';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import ApiError from '@utils/api-error';
import type { AnyRecord, Identifier } from '@app-types/common';

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toIsoDate(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toText(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function parseTimeToMinutes(input: unknown) {
  const value = String(input || '').trim();
  const [h, m] = value.split(':').map((x) => Number(x));
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function estimateSlotHours(slot: AnyRecord) {
  const start = parseTimeToMinutes(slot.startTime);
  const end = parseTimeToMinutes(slot.endTime);
  if (start === null || end === null) return 1;
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return Number((diff / 60).toFixed(2));
}

function normalizeIdList(value: unknown) {
  const values = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value ? [value] : [];
  const normalized = new Set<number>();
  for (const item of values) {
    const parsed = toNumber(item);
    if (parsed && parsed > 0) normalized.add(parsed);
  }
  return [...normalized].sort((a, b) => a - b);
}

class BonusCampaignService extends BaseService {
  constructor() {
    super('bonus_campaigns', bonusCampaignsRepository);
  }

  async createCampaign(payload: AnyRecord = {}, actorId: Identifier) {
    const semesterId = toNumber(payload.semesterId);
    if (!semesterId) throw ApiError.badRequest('semesterId là bắt buộc');

    const semester = await semestersRepository.findById(semesterId);
    if (!semester) throw ApiError.badRequest('semesterId không tồn tại');

    const count = await this.repository.count({ semesterId });
    const maDot = `${semesterId}${count + 1}`;

    const campaign = await this.repository.create({
      ...payload,
      semesterId,
      maDot,
      thoiGianBatDau: toIsoDate(payload.thoiGianBatDau),
      thoiGianKetThuc: toIsoDate(payload.thoiGianKetThuc),
      active: payload.active !== undefined ? payload.active : true,
      createdBy: toNumber(actorId),
      updatedBy: toNumber(actorId),
    });

    await this.notifyNewCampaign(campaign, toNumber(actorId));
    await auditLogsService.log({
      userId: toNumber(actorId) || 0,
      action: 'TẠO ĐỢT ĐIỂM THƯỞNG',
      module: 'BONUS_CAMPAIGNS',
      description: `Tạo đợt điểm thưởng ${campaign.maDot || campaign.id}`,
      resourceId: String(campaign.id),
    });

    return campaign;
  }

  async updateCampaign(id: Identifier, payload: AnyRecord = {}, actorId: Identifier) {
    const updated = await this.repository.update(toNumber(id), {
      ...payload,
      updatedBy: toNumber(actorId),
    });

    if (updated) {
      await auditLogsService.log({
        userId: toNumber(actorId) || 0,
        action: 'CẬP NHẬT ĐỢT ĐIỂM THƯỞNG',
        module: 'BONUS_CAMPAIGNS',
        description: `Cập nhật đợt điểm thưởng ${updated.maDot || updated.id}`,
        resourceId: String(updated.id),
      });
    }

    return updated;
  }

  async deleteCampaign(id: Identifier, actorId: Identifier) {
    const campaignId = toNumber(id);
    const campaign = await this.repository.findById(campaignId);
    const deleted = await this.repository.delete(campaignId);

    if (deleted) {
      await auditLogsService.log({
        userId: toNumber(actorId) || 0,
        action: 'XÓA ĐỢT ĐIỂM THƯỞNG',
        module: 'BONUS_CAMPAIGNS',
        description: `Xóa đợt điểm thưởng ${campaign?.maDot || campaignId}`,
        resourceId: String(campaignId),
      });
    }

    return { success: true, id: campaignId };
  }

  async calculateUserProgress(userId: number, campaign: AnyRecord) {
    const from = toIsoDate(campaign.evaluationFrom || campaign.thoiGianBatDau);
    const to = toIsoDate(campaign.evaluationTo || campaign.thoiGianKetThuc);
    if (!from || !to) return null;

    const slotsResult = await dutySlotsRepository.findAllAdvanced({
      limit: 10000,
      filter: { shiftDate_gte: from, shiftDate_lte: to },
    });
    const slots = slotsResult.data || [];

    let assignedSlots = 0;
    let attendedSlots = 0;
    let dutyHours = 0;

    for (const slot of slots) {
      const assigned = normalizeIdList(slot.assignedUserIds);
      const attended = normalizeIdList(slot.attendedUserIds);
      if (assigned.includes(userId)) assignedSlots++;
      if (attended.includes(userId)) {
        attendedSlots++;
        dutyHours += estimateSlotHours(slot);
      }
    }

    const minDutyHours = Number(campaign.minDutyHours) || 0;
    const maxAbsenceRate = Number(campaign.maxAbsenceRate) || 1;
    const absenceRate = assignedSlots === 0 ? 0 : (assignedSlots - attendedSlots) / assignedSlots;

    return {
      dutyHours: Number(dutyHours.toFixed(2)),
      minDutyHours,
      assignedSlots,
      attendedSlots,
      absenceRate: Number(absenceRate.toFixed(4)),
      maxAbsenceRate,
      eligible: dutyHours >= minDutyHours && absenceRate <= maxAbsenceRate,
    };
  }

  async registerCampaign(id: Identifier, user: AnyRecord = {}) {
    const userId = toNumber(user.id);
    const campaignId = toNumber(id);
    if (!userId || !campaignId) throw ApiError.unauthorized('Thông tin không hợp lệ');

    const campaign = await this.repository.findById(campaignId);
    if (!campaign || !campaign.active) throw ApiError.badRequest('Đợt không khả dụng');

    const now = Date.now();
    const start = new Date(campaign.thoiGianBatDau).getTime();
    const end = new Date(campaign.thoiGianKetThuc).getTime();
    if (now < start || now > end) throw ApiError.badRequest('Ngoài thời gian đăng ký');

    // Kiểm tra xem đã đăng ký chưa
    const existing = await bonusRegistrationService.getByUserAndCampaign(userId, campaignId);
    if (existing) throw ApiError.conflict('Bạn đã đăng ký đợt này rồi');

    const progress = await this.calculateUserProgress(userId, campaign);

    return await bonusRegistrationService.createRegistration(
      {
        campaignId,
        userId,
        status: 'registered',
        dutyHours: progress?.dutyHours || 0,
        absenceRate: progress?.absenceRate || 0,
        eligible: progress?.eligible || false,
        registeredAt: new Date().toISOString(),
      },
      userId,
    );
  }

  async reviewCampaign(id: Identifier, payload: AnyRecord = {}, actorId: Identifier) {
    const campaignId = toNumber(id);
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) throw ApiError.notFound('Không tìm thấy đợt');

    const registrations = await bonusRegistrationService.getByCampaign(campaignId);
    const manualApprovedIds = normalizeIdList(payload.approvedUserIds || []);
    const isManual = manualApprovedIds.length > 0;

    const results = {
      total: registrations.length,
      approved: 0,
      rejected: 0,
    };

    for (const reg of registrations) {
      const progress = await this.calculateUserProgress(reg.userId, campaign);
      const autoEligible = progress?.eligible || false;

      // Nếu có danh sách manual thì ưu tiên manual, ngược lại dùng auto
      const isApproved = isManual ? manualApprovedIds.includes(reg.userId) : autoEligible;

      const status = isApproved ? 'approved' : 'rejected';
      if (isApproved) results.approved++;
      else results.rejected++;

      await bonusRegistrationService.updateRegistration(
        reg.id,
        {
          status,
          dutyHours: progress?.dutyHours,
          absenceRate: progress?.absenceRate,
          eligible: autoEligible,
          reviewedAt: new Date().toISOString(),
          reviewedBy: toNumber(actorId),
          note: toText(payload.note || reg.note),
        },
        actorId,
      );
    }

    // Cập nhật trạng thái đợt
    await this.repository.update(campaignId, {
      status: 'approved',
    });

    await auditLogsService.log({
      userId: toNumber(actorId) || 0,
      action: 'DUYỆT ĐỢT ĐIỂM THƯỞNG',
      module: 'BONUS_CAMPAIGNS',
      description: `Duyệt đợt điểm thưởng ${campaign.maDot || campaignId}: ${results.approved} đạt, ${results.rejected} không đạt`,
      resourceId: String(campaignId),
    });

    return { success: true, ...results };
  }

  async listCampaigns(user: AnyRecord = {}, options: AnyRecord = {}) {
    const result = await this.repository.findAllAdvanced({
      ...options,
      order: 'desc',
      sort: 'thoiGianKetThuc',
    });

    const userId = toNumber(user.id);
    const data = [];
    for (const campaign of result.data || []) {
      const myRegistration = userId ? await bonusRegistrationService.getByUserAndCampaign(userId, campaign.id) : null;
      const myProgress = userId ? await this.calculateUserProgress(userId, campaign) : null;
      data.push({
        ...campaign,
        myRegistration,
        myProgress,
        isOpen: this.isOpen(campaign),
      });
    }
    return { ...result, data };
  }

  async getCampaignById(id: Identifier, user: AnyRecord = {}) {
    const campaign = await this.repository.findById(toNumber(id));
    if (!campaign) throw ApiError.notFound('Không tìm thấy đợt');

    const userId = toNumber(user.id);
    const myRegistration = userId ? await bonusRegistrationService.getByUserAndCampaign(userId, campaign.id) : null;
    const myProgress = userId ? await this.calculateUserProgress(userId, campaign) : null;

    return {
      ...campaign,
      myRegistration,
      myProgress,
      isOpen: this.isOpen(campaign),
    };
  }

  isOpen(campaign: AnyRecord) {
    const now = Date.now();
    const start = new Date(campaign.thoiGianBatDau).getTime();
    const end = new Date(campaign.thoiGianKetThuc).getTime();
    return campaign.active && now >= start && now <= end;
  }

  async notifyNewCampaign(campaign: AnyRecord, actorId: number | null) {
    const users = await usersRepository.findMany({ isActive: true });
    const userIds = users.map((u) => u.id).filter((id) => id !== actorId);
    if (userIds.length === 0) return;

    await notificationService.notifyUsers(userIds, {
      title: 'Mở đợt đăng ký cộng điểm',
      message: `Đợt ${campaign.maDot} đã mở đăng ký.`,
      category: 'system',
      type: 'system',
      refId: campaign.id,
    });
  }

  async exportApprovedExcel(id: Identifier) {
    const campaignId = toNumber(id);
    const campaign = await this.repository.findById(campaignId);
    if (!campaign) throw ApiError.notFound('Không tìm thấy đợt');

    const registrations = await bonusRegistrationService.getByCampaign(campaignId);
    const approvedRegs = registrations.filter((r) => r.status === 'approved');

    const users = await usersRepository.findMany({ id_in: approvedRegs.map((r) => r.userId) });
    const userMap = new Map(users.map((u) => [u.id, u]));

    const rows = approvedRegs.map((reg, index) => {
      const user = userMap.get(reg.userId) || {};
      return {
        STT: index + 1,
        MaSinhVien: user.studentId,
        HoTen: user.name,
        Email: user.email,
        MaDot: campaign.maDot,
        LoaiDiem: campaign.pointType?.toUpperCase(),
        GioTruc: reg.dutyHours,
        TiLeVang: reg.absenceRate,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Approved');
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    return {
      filename: `bonus-approved-${campaign.maDot}.xlsx`,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer,
    };
  }
}

export default new BonusCampaignService();
