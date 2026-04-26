import dutyTemplatesRepository from '@modules/duty/repositories/duty-templates.repository';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId } from './duty-utils';

class DutyTemplatesService {
  async getTemplates() {
    const all = await dutyTemplatesRepository.findGroups();
    return all.sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '', 'vi'));
  }

  async createTemplate(data: GenericRecord) {
    const template = await dutyTemplatesRepository.create({
      name: data.name,
      type: 'group',
      isDefault: !!data.isDefault,
      description: data.description || '',
    });
    if (data.isDefault) {
      const all = await dutyTemplatesRepository.findGroups();
      for (const t of all) {
        if (normalizeId(t.id) !== normalizeId(template.id) && t.isDefault) {
          await dutyTemplatesRepository.update(t.id, { isDefault: false });
        }
      }
    }
    return template;
  }

  async updateTemplate(id: Identifier, data: GenericRecord) {
    const updated = await dutyTemplatesRepository.update(id, {
      name: data.name,
      isDefault: !!data.isDefault,
      description: data.description || '',
    });
    if (data.isDefault) {
      const all = await dutyTemplatesRepository.findGroups();
      for (const t of all) {
        if (normalizeId(t.id) !== normalizeId(id) && t.isDefault) {
          await dutyTemplatesRepository.update(t.id, { isDefault: false });
        }
      }
    }
    return updated;
  }

  async deleteTemplate(id: Identifier) {
    const shifts = await dutyTemplatesRepository.findShiftsByGroupId(normalizeId(id));
    for (const s of shifts) {
      await this.deleteShiftTemplate(s.id);
    }
    return await dutyTemplatesRepository.delete(id);
  }

  async getShiftTemplates(templateId?: Identifier | null) {
    let filter: any = { type: 'shift' };
    if (templateId !== undefined) {
      if (templateId) {
        filter.parentId = normalizeId(templateId);
      } else if (templateId === null) {
        filter.parentId = null;
      }
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
    return await dutyTemplatesRepository.create({
      type: 'shift',
      parentId: data.templateId ? normalizeId(data.templateId) : null,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isSpecialEvent: !!data.isSpecialEvent,
      daysOfWeek: Array.isArray(data.daysOfWeek) ? data.daysOfWeek.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    });
  }

  private getDayName(day: number) {
    const days = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];
    return days[day] || `Ngày ${day}`;
  }

  async updateShiftTemplate(id: Identifier, data: GenericRecord) {
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

    return await dutyTemplatesRepository.update(id, {
      parentId: data.templateId ? normalizeId(data.templateId) : undefined,
      name: data.name,
      startTime: data.startTime,
      endTime: data.endTime,
      description: data.description || '',
      isSpecialEvent: data.isSpecialEvent !== undefined ? !!data.isSpecialEvent : undefined,
      daysOfWeek: newDays,
    });
  }

  async deleteShiftTemplate(id: Identifier) {
    await dutyTemplatesRepository.deleteByParentId(normalizeId(id));
    return await dutyTemplatesRepository.delete(id);
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

    return await dutyTemplatesRepository.create({
      type: 'kip',
      parentId: shiftId,
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      daysOfWeek: kipDays,
      description: data.description || '',
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

    return await dutyTemplatesRepository.update(id, {
      name: data.name,
      coefficient: Number(data.coefficient) || 1,
      capacity: Number(data.capacity) || 1,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      daysOfWeek: kipDays || kip.daysOfWeek,
      description: data.description || '',
    });
  }

  async deleteKipTemplate(id: Identifier) {
    return await dutyTemplatesRepository.delete(id);
  }
}

export default new DutyTemplatesService();
