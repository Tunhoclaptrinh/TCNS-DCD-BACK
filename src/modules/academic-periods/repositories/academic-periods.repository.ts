import BaseRepository from '@shared/repositories/base.repository';

class AcademicPeriodsRepository extends BaseRepository {
  constructor() {
    super('academic_periods');
  }
}

export default new AcademicPeriodsRepository();
