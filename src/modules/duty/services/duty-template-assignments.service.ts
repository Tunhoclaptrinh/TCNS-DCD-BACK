import BaseService from '@shared/common/base-service';
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';

class DutyTemplateAssignmentsService extends BaseService {
  constructor() {
    super('duty_template_assignments', dutyTemplateAssignmentsRepository);
  }

  /**
   * Get template assignments (compatibility alias)
   */
  async getTemplateAssignments() {
    return await this.findAll();
  }

  async beforeCreate(data: any) {
    const base = await super.beforeCreate(data);
    return {
      ...base,
      templateId: data.templateId ? Number(data.templateId) : undefined,
    };
  }

  async beforeUpdate(id: any, data: any) {
    const base = await super.beforeUpdate(id, data);
    const update: any = { ...base };
    if (data.startDate) update.startDate = new Date(data.startDate).toISOString();
    if (data.endDate) update.endDate = new Date(data.endDate).toISOString();
    if (data.templateId) update.templateId = Number(data.templateId);
    return update;
  }
}

export default new DutyTemplateAssignmentsService();
