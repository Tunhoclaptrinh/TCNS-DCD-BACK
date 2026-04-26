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
  createActualShift = (payload: GenericRecord, actorId: Identifier) =>
    dutySlotsService.createActualShift(payload, actorId);
  updateActualShift = (shiftId: number, data: GenericRecord) => dutySlotsService.updateActualShift(shiftId, data);
  createActualKip = (payload: GenericRecord, actorId: Identifier) => dutySlotsService.createActualKip(payload, actorId);
  deleteActualKip = (kipId: number) => dutySlotsService.deleteActualKip(kipId);
  createSlot = (payload: GenericRecord, actorId: Identifier) => dutySlotsService.createSlot(payload, actorId);
  deleteSlot = (id: Identifier, performerId: Identifier) => dutySlotsService.deleteSlot(id, performerId);
  updateSlot = (slotId: Identifier, payload: GenericRecord, performerId: Identifier) =>
    dutySlotsService.updateSlot(slotId, payload, performerId);
  registerToSlot = (slotId: Identifier, user: GenericRecord | Identifier) =>
    dutySlotsService.registerToSlot(slotId, user);
  cancelRegistration = (slotId: Identifier, user: GenericRecord | Identifier) =>
    dutySlotsService.cancelRegistration(slotId, user);
  markAttendance = (slotId: Identifier, userIds: Identifier[], performerId: Identifier) =>
    dutySlotsService.markAttendance(slotId, userIds, performerId);
  getStats = () => dutySlotsService.getStats();
  getUserStats = (userId: Identifier) => dutySlotsService.getUserStats(userId);

  // ==================== SWAP REQUESTS ====================
  requestSwap = (payload: GenericRecord, requesterUser: GenericRecord) =>
    dutySwapRequestsService.requestSwap(payload, requesterUser);
  decideSwap = (requestId: Identifier, payload: GenericRecord, approver: any) =>
    dutySwapRequestsService.decideSwap(requestId, payload, approver);
  createSwapManual = (data: GenericRecord, performerId: Identifier) =>
    dutySwapRequestsService.createSwapManual(data, performerId);
  updateSwapRequest = (id: Identifier, data: GenericRecord, performerId: Identifier) =>
    dutySwapRequestsService.updateSwapRequest(id, data, performerId);
  deleteSwapRequest = (id: Identifier) => dutySwapRequestsService.deleteSwapRequest(id);
  getSwapRequests = (user: GenericRecord, options: GenericRecord) =>
    dutySwapRequestsService.getSwapRequests(user, options);

  // ==================== LEAVE REQUESTS ====================
  requestLeave = (slotId: Identifier, userId: Identifier, reason: string) =>
    dutyLeaveRequestsService.requestLeave(slotId, userId, reason);
  createLeaveManual = (data: GenericRecord, performerId: Identifier) =>
    dutyLeaveRequestsService.createLeaveManual(data, performerId);
  updateLeaveRequest = (id: Identifier, data: GenericRecord, performerId: Identifier) =>
    dutyLeaveRequestsService.updateLeaveRequest(id, data, performerId);
  deleteLeaveRequest = (id: Identifier) => dutyLeaveRequestsService.deleteLeaveRequest(id);
  getLeaveRequests = (options: GenericRecord) => dutyLeaveRequestsService.getLeaveRequests(options);
  resolveLeaveRequest = (requestId: Identifier, status: string, approverId: Identifier, rejectionReason: string) =>
    dutyLeaveRequestsService.resolveLeaveRequest(requestId, status, approverId, rejectionReason);

  // ==================== GENERATION & BATCH OPERATIONS ====================
  generateWeekSlots = (weekStart: string, actorId: Identifier) =>
    dutyGenerationService.generateWeekSlots(weekStart, actorId);
  generateDaySlots = (date: string, actorId: Identifier) => dutyGenerationService.generateDaySlots(date, actorId);
  generateRangeSlots = (
    startDate: string,
    endDate: string,
    actorId: Identifier,
    templateId?: Identifier,
    mode?: string,
    jobId?: string,
  ) => dutyGenerationService.generateRangeSlots(startDate, endDate, actorId, templateId, mode, jobId);
  copyWeekSchedule = (sourceWeekStart: string, targetWeekStart: string, actorId: Identifier) =>
    dutyGenerationService.copyWeekSchedule(sourceWeekStart, targetWeekStart, actorId);
  deleteWeeklySlots = (weekStart: string) => dutyGenerationService.deleteWeeklySlots(weekStart);
  deleteRangeSlots = (startDate: string, endDate: string, performerId: Identifier) =>
    dutyGenerationService.deleteRangeSlots(startDate, endDate, performerId);
  deleteShiftSlots = (date: string, shiftId: number, performerId: Identifier) =>
    dutyGenerationService.deleteShiftSlots(date, shiftId, performerId);
  addShiftToDay = (date: string, shiftTemplateId: number, actorId: Identifier, overrides?: any, mode?: string) =>
    dutyGenerationService.addShiftToDay(date, shiftTemplateId, actorId, overrides, mode);
  removeShiftFromDay = (date: string, shiftInstanceId: number) =>
    dutyGenerationService.removeShiftFromDay(date, shiftInstanceId);

  // ==================== TEMPLATE ASSIGNMENTS ====================
  getTemplateAssignments = () => dutyTemplateAssignmentsService.getTemplateAssignments();
  createTemplateAssignment = (data: any, actorId: any) => dutyGenerationService.createTemplateAssignment(data, actorId);
  updateTemplateAssignment = (id: any, data: any) => dutyTemplateAssignmentsService.updateTemplateAssignment(id, data);
  deleteTemplateAssignment = (id: any) => dutyTemplateAssignmentsService.deleteTemplateAssignment(id);
}

export default new DutyService();
