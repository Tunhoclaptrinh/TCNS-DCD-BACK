import BaseService from '@shared/common/base-service';
import dutyTemplateAssignmentsRepository from '@modules/duty/repositories/duty-template-assignments.repository';
import { socketService } from '../../../services/socket.service';
import dayjs from 'dayjs';
import { Identifier, toUTCMidnight } from './duty-utils';
import dutyTemplatesService from './duty-templates.service';

class DutyTemplateAssignmentsService extends BaseService {
  constructor() {
    super('duty_template_assignments', dutyTemplateAssignmentsRepository);
  }

  async getTemplateAssignments() {
    return await dutyTemplateAssignmentsRepository.findAll();
  }

  async createTemplateAssignment(data: any, actorId: any) {
    const startDate = toUTCMidnight(data.startDate);
    const endDate = dayjs.utc(data.endDate).endOf('day').toDate();
    const templateId = parseInt(data.templateId, 10);
    const mode = data.mode || 'kips';
    const jobId = data.jobId;

    if (jobId) {
      socketService.emitToRoom(jobId, 'job_progress', { percent: 5, text: 'Đang phân tích cấu trúc Bản mẫu...' });
    }

    const shifts = await dutyTemplatesService.getShiftTemplates(templateId);
    if (!shifts || shifts.length === 0) {
      throw new Error('Bản mẫu này không có ca trực nào để áp dụng.');
    }

    let current = dayjs.utc(startDate).startOf('day');
    const end = dayjs.utc(endDate).startOf('day');
    const datesToInit: string[] = [];

    while (current.isSameOrBefore(end, 'day')) {
      datesToInit.push(current.format('YYYY-MM-DD'));
      current = current.add(1, 'day');
    }

    const results: any[] = [];
    const BATCH_SIZE = 15;
    const totalDays = datesToInit.length;

    for (let i = 0; i < totalDays; i += BATCH_SIZE) {
      if (jobId) {
        const percent = Math.floor(10 + (i / totalDays) * 85);
        socketService.emitToRoom(jobId, 'job_progress', {
          percent,
          text: `Đang xử lý dữ liệu từ ngày ${dayjs(datesToInit[i]).format('DD/MM')}...`,
        });
      }

      const batchDates = datesToInit.slice(i, i + BATCH_SIZE);
      const batchPromises = batchDates.map(async (dateStr) => {
        const dIdx = (dayjs.utc(dateStr).day() + 6) % 7;
        const localResults: any[] = [];

        for (const s of shifts as any[]) {
          const shiftDays = s.daysOfWeek || [0, 1, 2, 3, 4, 5, 6];
          if (shiftDays.includes(dIdx)) {
            await dutyTemplatesService.stampTemplateShift(dateStr, s.id, actorId, mode);
            localResults.push({ date: dateStr, shiftId: s.id });
          }
        }
        return { localResults };
      });

      const chunkResults = await Promise.all(batchPromises);
      for (const res of chunkResults) {
        results.push(...res.localResults);
      }
    }

    if (jobId) {
      socketService.emitToRoom(jobId, 'job_progress', { percent: 100, text: 'Hoàn tất chiến dịch lập lịch.' });
    }

    return { success: true, results };
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
