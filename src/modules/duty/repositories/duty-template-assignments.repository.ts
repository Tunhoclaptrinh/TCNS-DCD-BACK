import BaseRepository from '@shared/repositories/base.repository';

class DutyTemplateAssignmentsRepository extends BaseRepository {
  constructor() {
    super('duty_template_assignments');
  }
}

export default new DutyTemplateAssignmentsRepository();
