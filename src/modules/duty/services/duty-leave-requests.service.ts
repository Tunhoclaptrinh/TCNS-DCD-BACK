import BaseService from '@shared/common/base-service';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import notificationService from '@modules/notifications/services/notification.service';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, normalizeIdList } from './duty-utils';
import dutyLogsService from './duty-logs.service';
import dutySlotsService from './duty-slots.service';

class DutyLeaveRequestsService extends BaseService {
  constructor() {
    super('duty_leave_requests', dutyLeaveRequestsRepository);
  }

  /**
   * Request leave (compatibility alias)
   */
  async requestLeave(slotId: Identifier, userId: Identifier, reason: string) {
    return await this.create({
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
      reason,
      status: 'pending',
    });
  }

  async beforeCreate(data: GenericRecord) {
    const base = await super.beforeCreate(data);
    return {
      ...base,
      userId: normalizeId(data.userId),
      slotId: normalizeId(data.slotId),
      status: data.status || 'pending',
    };
  }

  async beforeUpdate(id: Identifier, data: GenericRecord) {
    const base = await super.beforeUpdate(id, data);
    return {
      ...base,
      userId: data.userId ? normalizeId(data.userId) : undefined,
      slotId: data.slotId ? normalizeId(data.slotId) : undefined,
    };
  }

  /**
   * Create leave manual (compatibility alias)
   */
  async createLeaveManual(data: GenericRecord, performerId: Identifier) {
    const status = data.status || 'pending';
    const request = await this.create({
      ...data,
      reason: data.reason || 'Admin tạo thủ công',
      approvedBy: status === 'approved' ? normalizeId(performerId) : undefined,
    });

    if (status === 'approved') {
      await this.resolveLeaveRequest(request.id, 'approved', performerId, data.rejectionReason || '');
    }
    return request;
  }

  /**
   * Update leave request (compatibility alias)
   */
  async updateLeaveRequest(id: Identifier, data: GenericRecord, performerId: Identifier) {
    const old = await dutyLeaveRequestsRepository.findById(id);
    if (!old) throw ApiError.notFound('Mục không tồn tại');

    const updated = await this.update(id, data);

    if (data.status === 'approved' && old.status !== 'approved') {
      await this.resolveLeaveRequest(id, 'approved', performerId, data.rejectionReason || '');
    }
    return updated;
  }

  /**
   * Get leave requests with slot labels
   */
  async getLeaveRequests(options: GenericRecord = {}) {
    const result = await this.findAll({
      expand: 'user,slot,approver',
      sort: 'createdAt',
      order: 'desc',
      ...options,
    });

    // Enrich slots with labels
    if (result.data) {
      await Promise.all(
        result.data.map(async (req: any) => {
          if (req.slot) {
            req.slot.shiftLabel = await dutySlotsService.getSlotLabel(req.slot);
          }
        }),
      );
    }

    return result;
  }

  async resolveLeaveRequest(
    requestId: Identifier,
    status: string,
    approverId: Identifier,
    rejectionReason: string = '',
  ) {
    const request = await dutyLeaveRequestsRepository.findById(requestId);
    if (!request) throw ApiError.notFound('Đơn xin nghỉ không tồn tại');

    const now = new Date().toISOString();
    const updated = await this.update(requestId, {
      status,
      approvedBy: normalizeId(approverId),
      rejectionReason,
    });

    if (status === 'approved') {
      const slot = await dutySlotsRepository.findById(request.slotId);
      if (slot) {
        const assigned = normalizeIdList(slot.assignedUserIds || []);
        await dutySlotsRepository.update(slot.id, {
          assignedUserIds: assigned.filter((id) => normalizeId(id) !== normalizeId(request.userId)),
          updatedAt: now,
        });

        const label = await dutySlotsService.getSlotLabel(slot);
        await dutyLogsService.log(
          'leave',
          'approved',
          `Duyệt đơn nghỉ kíp: ${label || slot.id}`,
          approverId,
          request.userId,
          slot.id,
          requestId,
        );

        await notificationService.notifyUser(request.userId as number, {
          title: 'Đơn xin nghỉ đã được duyệt',
          message: `Yêu cầu xin nghỉ cho kíp ${label || ''} của bạn đã được chấp thuận.`,
          category: 'duty',
          type: 'leave',
          refId: request.id,
        });
      }
    } else if (status === 'rejected') {
      await dutyLogsService.log(
        'leave',
        'rejected',
        `Từ chối đơn nghỉ. Lý do: ${rejectionReason || 'Không có'}`,
        approverId,
        request.userId,
        request.slotId,
        requestId,
      );
      await notificationService.notifyUser(request.userId as number, {
        title: 'Đơn xin nghỉ bị từ chối',
        message: `Yêu cầu xin nghỉ của bạn đã bị từ chối. Lý do: ${rejectionReason || 'Không có'}`,
        category: 'duty',
        type: 'leave',
        refId: request.id,
      });
    }

    return updated;
  }
}

export default new DutyLeaveRequestsService();
