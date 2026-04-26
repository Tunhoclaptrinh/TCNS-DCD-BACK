import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import dayjs from 'dayjs';
import { toUTCMidnight } from './duty-utils';

class DutyTemplateAssignmentsService {
  async getTemplateAssignments() {
    return await dutyTemplateAssignmentsRepository.findAll();
  }

  async updateTemplateAssignment(id: any, data: any) {
    const update: any = { updatedAt: new Date().toISOString() };
    if (data.startDate) update.startDate = new Date(data.startDate).toISOString();
    if (data.endDate) update.endDate = new Date(data.endDate).toISOString();
    if (data.templateId) update.templateId = parseInt(data.templateId, 10);
    if (data.note !== undefined) update.note = data.note;

    return await dutyTemplateAssignmentsRepository.update(id, update);
  }

  async deleteTemplateAssignment(id: any) {
    return await dutyTemplateAssignmentsRepository.delete(id);
  }
}

export default new DutyTemplateAssignmentsService();
