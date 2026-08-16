import BaseService from '@shared/common/base-service';
import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, adjustKipTimeWindow } from './duty-utils';

class DutyTemplatesService extends BaseService {
  constructor() {
    super('duty_templates', dutyTemplatesRepository);
  }

  /**
   * Get all template groups, sorted by name
   */
  async getTemplates() {
    const all = await dutyTemplatesRepository.findGroups();
    return all.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }

  /**
   * Override create/update hooks to handle group-specific logic
   */
  async beforeCreate(data: GenericRecord) {
    const base = await super.beforeCreate(data);
    const type = data.type || 'group';
    const rawParentId = data.parentId || data.templateId || data.shiftId || data.templateShiftId;

    return {
      ...base,
      type,
      isDefault: data.isDefault !== undefined ? !!data.isDefault : type === 'group' ? false : undefined,
      parentId: rawParentId ? normalizeId(rawParentId) : undefined,
    };
  }

  async afterCreate(template: any) {
    if (template.isDefault) {
      await this.handleDefaultGroupExclusivity(template.id);
    }
    await super.afterCreate(template);
  }

  async beforeUpdate(id: Identifier, data: GenericRecord) {
    const base = await super.beforeUpdate(id, data);
    const rawParentId = data.parentId || data.templateId || data.shiftId || data.templateShiftId;
    return {
      ...base,
      isDefault: data.isDefault !== undefined ? !!data.isDefault : undefined,
      parentId: rawParentId ? normalizeId(rawParentId) : undefined,
    };
  }

  async afterUpdate(updated: any) {
    if (updated.isDefault) {
      await this.handleDefaultGroupExclusivity(updated.id);
    }
    await super.afterUpdate(updated);
  }

  private async handleDefaultGroupExclusivity(currentId: Identifier) {
    const all = await dutyTemplatesRepository.findGroups();
    for (const t of all) {
      if (normalizeId(t.id) !== normalizeId(currentId) && t.isDefault) {
        await dutyTemplatesRepository.update(t.id, { isDefault: false });
      }
    }
  }

  async beforeDelete(id: Identifier) {
    // Cascade delete shifts and kips
    const shifts = await dutyTemplatesRepository.findShiftsByGroupId(normalizeId(id));
    for (const s of shifts) {
      await this.deleteShiftTemplate(s.id);
    }
    await super.beforeDelete(id);
  }

  async getShiftTemplates(templateId?: Identifier | null) {
    const filter: any = { type: 'shift' };
    if (templateId && templateId !== 'null' && templateId !== 'undefined') {
      filter.parentId = normalizeId(templateId);
    }

    const shifts = await dutyTemplatesRepository.findMany(filter);
    const kips = await dutyTemplatesRepository.findMany({ type: 'kip' });
    return shifts
      .map((shift: any) => ({
        ...shift,
        kips: kips
          .filter((k: any) => normalizeId(k.parentId) === normalizeId(shift.id))
          .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || '')),
      }))
      .sort((a: any, b: any) => (a.startTime || '').localeCompare(b.startTime || ''));
  }

  async createShiftTemplate(data: GenericRecord) {
    return await this.create({
      ...data,
      type: 'shift',
      parentId: data.templateId || data.parentId,
    });
  }

  private getDayName(day: number) {
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    return days[day] || `Ngày ${day}`;
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
    const oldShift = await dutyTemplatesRepository.findById(id);

    const newDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : undefined;
    if (newDays) {
      const kips = await dutyTemplatesRepository.findKipsByShiftId(id);
      for (const kip of kips) {
        const kipDays = kip.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        const invalid = kipDays.filter((d: number) => !newDays.includes(d));
        if (invalid.length > 0) {
          const invalidNames = invalid.map((d: number) => this.getDayName(d)).join(', ');
          throw ApiError.badRequest(
            `Không thể cập nhật: Kíp '${kip.name}' đang có ngày trực (${invalidNames}) không nằm trong danh sách ngày mới của Ca.`,
          );
        }
      }
    }

    // Tự động điều chỉnh khung giờ các Kíp con thuộc Ca nếu thời gian Ca thay đổi
    if (oldShift && (data.startTime || data.endTime)) {
      const newStart = data.startTime || oldShift.startTime;
      const newEnd = data.endTime || oldShift.endTime;
      const kips = await dutyTemplatesRepository.findKipsByShiftId(id);
      for (const kip of kips) {
        const adjustedTime = adjustKipTimeWindow(
          kip.startTime,
          kip.endTime,
          oldShift.startTime,
          oldShift.endTime,
          newStart,
          newEnd,
        );
        await dutyTemplatesRepository.update(kip.id, adjustedTime);
      }
    }

    return await this.update(id, {
      ...data,
      parentId: data.templateId || data.parentId,
    });
  }

  async deleteShiftTemplate(id: Identifier) {
    await dutyTemplatesRepository.deleteByParentId(normalizeId(id));
    return await this.delete(id);
  }

  async createKipTemplate(data: GenericRecord) {
    const shiftId = normalizeId(data.templateShiftId || data.shiftId || data.parentId);
    const kipDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6];

    const shift = await dutyTemplatesRepository.findById(shiftId);
    if (shift) {
      const shiftDays = shift.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
      const invalid = kipDays.filter((d) => !shiftDays.includes(d));
      if (invalid.length > 0) {
        const invalidNames = invalid.map((d) => this.getDayName(d)).join(', ');
        throw ApiError.badRequest(`Kíp có ngày trực không thuộc Ca trực (${invalidNames}).`);
      }
    }

    return await this.create({
      ...data,
      type: 'kip',
      parentId: shiftId,
      daysOfWeek: kipDays,
    });
  }

  async updateKipTemplate(id: Identifier, data: GenericRecord) {
    const kip = await dutyTemplatesRepository.findById(id);
    if (!kip) throw ApiError.notFound('Kíp không tồn tại');

    const kipDays = Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : undefined;

    if (kipDays) {
      const shift = await dutyTemplatesRepository.findById(kip.parentId);
      if (shift) {
        const shiftDays = shift.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
        const invalid = kipDays.filter((d) => !shiftDays.includes(d));
        if (invalid.length > 0) {
          const invalidNames = invalid.map((d) => this.getDayName(d)).join(', ');
          throw ApiError.badRequest(`Kíp có ngày trực không thuộc Ca trực (${invalidNames}).`);
        }
      }
    }

    return await this.update(id, {
      ...data,
      daysOfWeek: kipDays || kip.daysOfWeek,
    });
  }

  async deleteKipTemplate(id: Identifier) {
    return await this.delete(id);
  }
}

export default new DutyTemplatesService();
