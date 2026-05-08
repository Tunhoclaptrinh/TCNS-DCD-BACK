import BaseService from '@shared/common/base-service';
import semestersRepository from '../repositories/semesters.repository';
import semesterSchema from '../schemas/semester.schema';
import ApiError from '@utils/api-error';
import type { AnyRecord, Identifier } from '@app-types/common';

class SemestersService extends BaseService {
  constructor() {
    super('semesters', semestersRepository);
  }

  getSchema() {
    return semesterSchema;
  }

  async afterCreate(item: AnyRecord) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(item.id);
    }
  }

  async afterUpdate(item: AnyRecord) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(item.id);
    }
  }

  async ensureOnlyOneCurrent(currentId: Identifier) {
    const semesters = await this.repository.findAll();
    const updates = semesters
      .filter((s: any) => Number(s.id) !== Number(currentId) && s.isCurrent)
      .map((s: any) =>
        this.repository.update(s.id, {
          isCurrent: false,
        }),
      );

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }

  async setCurrent(id: Identifier) {
    const item = await this.repository.findById(id);
    if (!item) throw ApiError.notFound('Không tìm thấy học kỳ');

    const updated = await this.repository.update(id, {
      isCurrent: true,
    });

    await this.ensureOnlyOneCurrent(id);
    return updated;
  }
}

export default new SemestersService();
