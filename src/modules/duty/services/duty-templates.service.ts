import BaseService from '@shared/common/base-service';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyDaysRepository from '@modules/duty/repositories/duty-days.repository';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, toUTCMidnight } from './duty-utils';

class DutyTemplatesService extends BaseService {
  constructor() {
    super('duty_templates', dutyTemplatesRepository);
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
      console.error('❌ Migration failed:', err);
    }
  }

  async getTemplates() {
    return await dutyTemplatesRepository.findAll();
  }

  async createTemplate(data: GenericRecord) {
    return await dutyTemplatesRepository.create(data);
  }

  async updateTemplate(id: Identifier, data: GenericRecord) {
    return await dutyTemplatesRepository.update(id, data);
  }

  async deleteTemplate(id: Identifier) {
    return await dutyTemplatesRepository.delete(id);
  }

  async getShiftTemplates(templateId?: string | number) {
    const filter = templateId ? { templateId: normalizeId(templateId), isTemplate: true } : { isTemplate: true };
    return await dutyShiftsRepository.findMany(filter);
  }

  async createShiftTemplate(data: GenericRecord) {
    return await dutyShiftsRepository.create({ ...data, isTemplate: true });
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
    return await dutyShiftsRepository.update(id, data);
  }

  async deleteShiftTemplate(id: Identifier) {
    return await dutyShiftsRepository.delete(id);
  }

  async createKipTemplate(data: GenericRecord) {
    return await dutyKipsRepository.create({ ...data, isTemplate: true });
  }

  async updateKipTemplate(id: Identifier, data: GenericRecord) {
    return await dutyKipsRepository.update(id, data);
  }

  async deleteKipTemplate(id: Identifier) {
    return await dutyKipsRepository.delete(id);
  }

  async stampTemplateShift(dateStr: string, templateShiftId: Identifier, actorId: Identifier, mode: string = 'kips') {
    const templateShift = await dutyShiftsRepository.findById(templateShiftId);
    if (!templateShift) return null;

    const shiftDate = toUTCMidnight(dateStr);
    const isoDate = shiftDate.toISOString();

    const existingShift = await dutyShiftsRepository.findOne({
      shiftDate: isoDate,
      templateId: templateShift.templateId,
      name: templateShift.name,
      isTemplate: false,
    });

    let actualShift = existingShift;
    if (!actualShift) {
      actualShift = await dutyShiftsRepository.create({
        ...templateShift,
        id: undefined,
        _id: undefined,
        isTemplate: false,
        shiftDate: isoDate,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    if (mode === 'kips' || mode === 'all') {
      const kipTemplates = await dutyKipsRepository.findMany({
        shiftId: templateShift.id,
        isTemplate: true,
      });

      for (const kt of kipTemplates) {
        const existingKip = await dutyKipsRepository.findOne({
          shiftId: actualShift.id,
          name: kt.name,
          isTemplate: false,
        });

        if (!existingKip) {
          const actualKip = await dutyKipsRepository.create({
            ...kt,
            id: undefined,
            _id: undefined,
            isTemplate: false,
            shiftId: actualShift.id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });

          await dutySlotsRepository.create({
            kipId: actualKip.id,
            shiftId: actualShift.id,
            shiftDate: isoDate,
            shiftLabel: `${actualShift.name} - ${actualKip.name}`,
            startTime: actualKip.startTime || actualShift.startTime,
            endTime: actualKip.endTime || actualShift.endTime,
            capacity: actualKip.capacity || 1,
            slotStructure: actualKip.slotStructure || [],
            assignedUserIds: [],
            attendedUserIds: [],
            status: 'open',
            weekStart: actualShift.weekStart || actualShift.shiftDate,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    }

    return actualShift;
  }
}

export default new DutyTemplatesService();
