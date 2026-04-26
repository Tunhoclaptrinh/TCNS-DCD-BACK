import BaseService from '@shared/common/base-service';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';

// Sub-services
import dutySettingsService from './duty-settings.service';
import dutyTemplatesService from './duty-templates.service';
import dutySlotsService from './duty-slots.service';
import dutySwapRequestsService from './duty-swap-requests.service';
import dutyLeaveRequestsService from './duty-leave-requests.service';
import dutyTemplateAssignmentsService from './duty-template-assignments.service';
import dutyGenerationService from './duty-generation.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';

import { Identifier, GenericRecord } from './duty-utils';

class DutyService extends BaseService {
  constructor() {
    super('duty_slots', dutySlotsRepository);
    // Wait for DB to be ready then migrate
    setTimeout(() => this.ensureDataIntegrity(), 2000);
  }

  private async ensureDataIntegrity() {
    try {
      const mongoose = (await import('mongoose')).default;
      const db = mongoose.connection.db;
      if (!db) return;

      const collections = await db.listCollections().toArray();
      const collNames = collections.map((c) => c.name);
      const templatesColl = db.collection('duty_templates');

      // 1. Groups
      await templatesColl.updateMany(
        { $or: [{ type: { $exists: false } }, { type: null }, { type: '' }] },
        { $set: { type: 'group' } },
      );

      // 2. Shifts
      if (collNames.includes('duty_template_shifts')) {
        const shiftsColl = db.collection('duty_template_shifts');
        const shifts = await shiftsColl.find({}).toArray();

        if (shifts.length > 0) {
          const maxIdDoc = await templatesColl.find().sort({ id: -1 }).limit(1).toArray();
          let nextId = (maxIdDoc[0]?.id || 0) + 1;
          if (nextId < 100) nextId = 100;

          const shiftOldToNewMap = new Map();

          for (const s of shifts) {
            const { _id, id: oldId, templateId, ...rest } = s as any;
            const newId = nextId++;
            shiftOldToNewMap.set(oldId, newId);

            await templatesColl.updateOne(
              { oldId: oldId, oldType: 'shift' },
              {
                $set: { ...rest, id: newId, type: 'shift', parentId: templateId, templateId, oldId, oldType: 'shift' },
              },
              { upsert: true },
            );
          }

          // 3. Kips
          if (collNames.includes('duty_template_kips')) {
            const kipsColl = db.collection('duty_template_kips');
            const kips = await kipsColl.find({}).toArray();
            for (const k of kips) {
              const { _id, id: oldKipId, templateShiftId, ...rest } = k as any;
              const newKipId = nextId++;
              const newParentId = shiftOldToNewMap.get(templateShiftId) || templateShiftId;

              const originalShift = shifts.find((s) => s.id === templateShiftId);
              const groupId = originalShift?.templateId;

              await templatesColl.updateOne(
                { oldId: oldKipId, oldType: 'kip' },
                {
                  $set: {
                    ...rest,
                    id: newKipId,
                    type: 'kip',
                    parentId: newParentId,
                    templateId: groupId,
                    oldId: oldKipId,
                    oldType: 'kip',
                  },
                },
                { upsert: true },
              );
            }
          }
          console.log('✅ Migration triggered from service successful');
        }
      }
    } catch (err) {
      console.error('❌ Migration Error in service:', err);
    }
  }

  // ==================== SETTINGS MANAGEMENT ====================
  getSettings = () => dutySettingsService.getSettings();
  updateSettings = (data: GenericRecord) => dutySettingsService.updateSettings(data);

  // ==================== TEMPLATE MANAGEMENT ====================
  getTemplates = () => dutyTemplatesService.getTemplates();
  createTemplate = (data: GenericRecord) => dutyTemplatesService.createTemplate(data);
  updateTemplate = (id: Identifier, data: GenericRecord) => dutyTemplatesService.updateTemplate(id, data);
  deleteTemplate = (id: Identifier) => dutyTemplatesService.deleteTemplate(id);

  getShiftTemplates = (templateId?: Identifier | null) => dutyTemplatesService.getShiftTemplates(templateId);
  createShiftTemplate = (data: GenericRecord) => dutyTemplatesService.createShiftTemplate(data);
  updateShiftTemplate = (id: Identifier, data: GenericRecord) => dutyTemplatesService.updateShiftTemplate(id, data);
  deleteShiftTemplate = (id: Identifier) => dutyTemplatesService.deleteShiftTemplate(id);

  createKipTemplate = (data: GenericRecord) => dutyTemplatesService.createKipTemplate(data);
  updateKipTemplate = (id: Identifier, data: GenericRecord) => dutyTemplatesService.updateKipTemplate(id, data);
  deleteKipTemplate = (id: Identifier) => dutyTemplatesService.deleteKipTemplate(id);

  // ==================== SLOT & SCHEDULE MANAGEMENT ====================
  getWeeklySchedule = (options: any = {}) => dutySlotsService.getWeeklySchedule(options);
  createActualShift = async (payload: GenericRecord, actorId: Identifier) => {
    const data = await dutySlotsService.createActualShift(payload, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Tạo ca trực thực tế: ${data?.name || 'Không rõ tên'}`,
      ...(data?.id !== undefined ? { resourceId: String(data.id) } : {}),
    });

    return data;
  };
  updateActualShift = (shiftId: number, data: GenericRecord) => dutySlotsService.updateActualShift(shiftId, data);
  createActualKip = async (payload: GenericRecord, actorId: Identifier) => {
    const data = await dutySlotsService.createActualKip(payload, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Tạo kíp trực thực tế: ${data?.name || 'Không rõ tên'}`,
      ...(data?.id !== undefined ? { resourceId: String(data.id) } : {}),
    });

    return data;
  };
  deleteActualKip = (kipId: number) => dutySlotsService.deleteActualKip(kipId);
  createSlot = async (payload: GenericRecord, actorId: Identifier) => {
    const data = await dutySlotsService.createSlot(payload, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: 'Tạo slot trực mới',
      ...(data?.id !== undefined ? { resourceId: String(data.id) } : {}),
    });

    return data;
  };
  deleteSlot = async (id: Identifier, performerId: Identifier) => {
    const data = await dutySlotsService.deleteSlot(id, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'XÓA DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Xóa slot trực #${id}`,
      resourceId: String(id),
    });

    return data;
  };
  updateSlot = async (slotId: Identifier, payload: GenericRecord, performerId: Identifier) => {
    const data = await dutySlotsService.updateSlot(slotId, payload, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Cập nhật slot trực #${slotId}`,
      resourceId: String(slotId),
    });

    return data;
  };
  registerToSlot = async (slotId: Identifier, user: GenericRecord | Identifier) => {
    const data = await dutySlotsService.registerToSlot(slotId, user);
    const userId = (typeof user === 'object' && user !== null ? Number(user.id) : Number(user)) || 0;

    await auditLogsService.log({
      userId,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Đăng ký vào slot trực #${slotId}`,
      resourceId: String(slotId),
    });

    return data;
  };
  cancelRegistration = async (slotId: Identifier, user: GenericRecord | Identifier) => {
    const data = await dutySlotsService.cancelRegistration(slotId, user);
    const userId = (typeof user === 'object' && user !== null ? Number(user.id) : Number(user)) || 0;

    await auditLogsService.log({
      userId,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Hủy đăng ký slot trực #${slotId}`,
      resourceId: String(slotId),
    });

    return data;
  };
  markAttendance = async (slotId: Identifier, userIds: Identifier[], performerId: Identifier) => {
    const data = await dutySlotsService.markAttendance(slotId, userIds, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Điểm danh cho slot trực #${slotId}`,
      resourceId: String(slotId),
    });

    return data;
  };
  getStats = () => dutySlotsService.getStats();
  getUserStats = (userId: Identifier) => dutySlotsService.getUserStats(userId);

  // ==================== SWAP REQUESTS ====================
  requestSwap = async (payload: GenericRecord, requesterUser: GenericRecord) => {
    const data = await dutySwapRequestsService.requestSwap(payload, requesterUser);

    await auditLogsService.log({
      userId: Number(requesterUser?.id) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: 'Tạo yêu cầu đổi/chuyển ca trực',
      ...(data?.id !== undefined ? { resourceId: String(data.id) } : {}),
    });

    return data;
  };
  decideSwap = async (requestId: Identifier, payload: GenericRecord, approver: any) => {
    const data = await dutySwapRequestsService.decideSwap(requestId, payload, approver);
    const approverId = typeof approver === 'object' && approver !== null ? Number(approver.id) : Number(approver);

    await auditLogsService.log({
      userId: approverId || 0,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Xử lý yêu cầu đổi ca #${requestId}`,
      resourceId: String(requestId),
    });

    return data;
  };
  createSwapManual = async (data: GenericRecord, performerId: Identifier) => {
    const created = await dutySwapRequestsService.createSwapManual(data, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: 'Tạo yêu cầu đổi ca thủ công',
      ...(created?.id !== undefined ? { resourceId: String(created.id) } : {}),
    });

    return created;
  };
  updateSwapRequest = async (id: Identifier, data: GenericRecord, performerId: Identifier) => {
    const updated = await dutySwapRequestsService.updateSwapRequest(id, data, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Cập nhật yêu cầu đổi ca #${id}`,
      resourceId: String(id),
    });

    return updated;
  };
  deleteSwapRequest = (id: Identifier) => dutySwapRequestsService.deleteSwapRequest(id);
  getSwapRequests = (user: GenericRecord, options: GenericRecord) =>
    dutySwapRequestsService.getSwapRequests(user, options);

  // ==================== LEAVE REQUESTS ====================
  requestLeave = async (slotId: Identifier, userId: Identifier, reason: string) => {
    const data = await dutyLeaveRequestsService.requestLeave(slotId, userId, reason);

    await auditLogsService.log({
      userId: Number(userId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Tạo đơn xin nghỉ cho slot #${slotId}`,
      ...(data?.id !== undefined ? { resourceId: String(data.id) } : {}),
    });

    return data;
  };
  createLeaveManual = async (data: GenericRecord, performerId: Identifier) => {
    const created = await dutyLeaveRequestsService.createLeaveManual(data, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: 'Tạo đơn nghỉ thủ công',
      ...(created?.id !== undefined ? { resourceId: String(created.id) } : {}),
    });

    return created;
  };
  updateLeaveRequest = async (id: Identifier, data: GenericRecord, performerId: Identifier) => {
    const updated = await dutyLeaveRequestsService.updateLeaveRequest(id, data, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Cập nhật đơn nghỉ #${id}`,
      resourceId: String(id),
    });

    return updated;
  };
  deleteLeaveRequest = (id: Identifier) => dutyLeaveRequestsService.deleteLeaveRequest(id);
  getLeaveRequests = (options: GenericRecord) => dutyLeaveRequestsService.getLeaveRequests(options);
  resolveLeaveRequest = async (
    requestId: Identifier,
    status: string,
    approverId: Identifier,
    rejectionReason: string,
  ) => {
    const data = await dutyLeaveRequestsService.resolveLeaveRequest(requestId, status, approverId, rejectionReason);

    await auditLogsService.log({
      userId: Number(approverId) || 0,
      action: 'CẬP NHẬT DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Duyệt đơn nghỉ #${requestId} với trạng thái ${status}`,
      resourceId: String(requestId),
    });

    return data;
  };

  // ==================== GENERATION & BATCH OPERATIONS ====================
  generateWeekSlots = async (weekStart: string, actorId: Identifier) => {
    const data = await dutyGenerationService.generateWeekSlots(weekStart, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Sinh lịch trực theo tuần bắt đầu ${weekStart}`,
    });

    return data;
  };
  generateDaySlots = async (date: string, actorId: Identifier) => {
    const data = await dutyGenerationService.generateDaySlots(date, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Sinh lịch trực theo ngày ${date}`,
    });

    return data;
  };
  generateRangeSlots = async (
    startDate: string,
    endDate: string,
    actorId: Identifier,
    templateId?: Identifier,
    mode?: string,
    jobId?: string,
  ) => {
    const data = await dutyGenerationService.generateRangeSlots(startDate, endDate, actorId, templateId, mode, jobId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Sinh lịch trực theo khoảng ngày ${startDate} - ${endDate}`,
    });

    return data;
  };
  copyWeekSchedule = async (sourceWeekStart: string, targetWeekStart: string, actorId: Identifier) => {
    const data = await dutyGenerationService.copyWeekSchedule(sourceWeekStart, targetWeekStart, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Sao chép lịch trực từ tuần ${sourceWeekStart} sang tuần ${targetWeekStart}`,
    });

    return data;
  };
  deleteWeeklySlots = (weekStart: string) => dutyGenerationService.deleteWeeklySlots(weekStart);
  deleteRangeSlots = async (startDate: string, endDate: string, performerId: Identifier) => {
    const data = await dutyGenerationService.deleteRangeSlots(startDate, endDate, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'XÓA DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Xóa lịch trực theo khoảng ngày ${startDate} - ${endDate}`,
    });

    return data;
  };
  deleteShiftSlots = async (date: string, shiftId: number, performerId: Identifier) => {
    const data = await dutyGenerationService.deleteShiftSlots(date, shiftId, performerId);

    await auditLogsService.log({
      userId: Number(performerId) || 0,
      action: 'XÓA DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Xóa các slot của ca #${shiftId} ngày ${date}`,
      resourceId: String(shiftId),
    });

    return data;
  };
  addShiftToDay = async (
    date: string,
    shiftTemplateId: number,
    actorId: Identifier,
    overrides?: any,
    mode?: string,
  ) => {
    const data = await dutyGenerationService.addShiftToDay(date, shiftTemplateId, actorId, overrides, mode);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: `Thêm ca mẫu #${shiftTemplateId} vào ngày ${date}`,
      resourceId: String(shiftTemplateId),
    });

    return data;
  };
  removeShiftFromDay = (date: string, shiftInstanceId: number) =>
    dutyGenerationService.removeShiftFromDay(date, shiftInstanceId);

  // ==================== TEMPLATE ASSIGNMENTS ====================
  getTemplateAssignments = () => dutyTemplateAssignmentsService.getTemplateAssignments();
  createTemplateAssignment = async (data: any, actorId: any) => {
    const created = await dutyGenerationService.createTemplateAssignment(data, actorId);

    await auditLogsService.log({
      userId: Number(actorId) || 0,
      action: 'THÊM DỮ LIỆU TRỰC',
      module: 'DUTY',
      description: 'Thêm phân công bản mẫu lịch trực',
    });

    return created;
  };
  updateTemplateAssignment = (id: any, data: any) => dutyTemplateAssignmentsService.updateTemplateAssignment(id, data);
  deleteTemplateAssignment = (id: any) => dutyTemplateAssignmentsService.deleteTemplateAssignment(id);
}

export default new DutyService();
