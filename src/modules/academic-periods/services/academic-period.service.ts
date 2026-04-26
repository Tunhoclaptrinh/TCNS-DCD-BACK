import BaseService from '@shared/common/base-service';
import academicPeriodsRepository from '@modules/academic-periods/repositories/academic-periods.repository';
import type { AnyRecord, Identifier } from '@app-types/common';

class AcademicPeriodService extends BaseService {
  constructor() {
    super('academic_periods', academicPeriodsRepository);
  }

  async createPeriod(payload: AnyRecord = {}, actorId: Identifier) {
    const currentYear = new Date().getFullYear();
    const ma = String(payload.ma || currentYear);

    const count = await this.repository.count({});
    const maHocKy = `${ma}${count + 1}`;

    const now = new Date().toISOString();
    return await this.repository.create({
      ...payload,
      ma,
      maHocKy,
      createdAt: now,
      updatedAt: now,
    });
  }

  async updatePeriod(id: Identifier, payload: AnyRecord = {}, actorId: Identifier) {
    return await this.repository.update(id, {
      ...payload,
      updatedAt: new Date().toISOString(),
    });
  }

  async getCurrentPeriod() {
    const result = await this.repository.findAllAdvanced({
      filter: { active: true },
      limit: 1,
      sort: 'maHocKy',
      order: 'desc',
    });
    return result.data?.[0] || null;
  }
}

export default new AcademicPeriodService();
