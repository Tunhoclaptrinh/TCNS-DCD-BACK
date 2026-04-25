import BaseService from '@shared/common/base-service';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyLogsRepository from '@modules/duty/repositories/duty-logs.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, normalizeIdList } from './duty-utils';

class DutyLeaveRequestsService extends BaseService {
  constructor() {
    super('duty_leave_requests', dutyLeaveRequestsRepository);
  }

  async requestLeave(slotId: Identifier, userId: Identifier, reason: string) {
    return await dutyLeaveRequestsRepository.create({
      slotId: normalizeId(slotId),
      userId: normalizeId(userId),
      reason,
      status: 'pending',
    });
  }

  async createLeaveManual(data: GenericRecord, performerId: Identifier) {
    const { userId, slotId, reason, status = 'pending', rejectionReason = '' } = data;

    const request = await dutyLeaveRequestsRepository.create({
      userId: normalizeId(userId),
      slotId: normalizeId(slotId),
      reason: reason || 'Admin tạo thủ công',
      status,
      rejectionReason,
      approvedBy: status === 'approved' ? normalizeId(performerId) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (status === 'approved') {
      await this.resolveLeaveRequest(request.id, 'approved', performerId, rejectionReason);
    }

    return request;
  }

  async updateLeaveRequest(id: Identifier, data: GenericRecord, performerId: Identifier) {
    const old = await dutyLeaveRequestsRepository.findById(id);
    if (!old) throw ApiError.notFound('Mục không tồn tại');

    const updated = await dutyLeaveRequestsRepository.update(id, {
      ...data,
      updatedAt: new Date().toISOString(),
    });

    if (data.status === 'approved' && old.status !== 'approved') {
      await this.resolveLeaveRequest(id, 'approved', performerId, data.rejectionReason || '');
    }

    return updated;
  }

  async deleteLeaveRequest(id: Identifier) {
    return await dutyLeaveRequestsRepository.delete(id);
  }

  async getLeaveRequests(options: GenericRecord = {}) {
    const result = await dutyLeaveRequestsRepository.findAllAdvanced({
      ...options,
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
    });

    const users = await usersRepository.findAll();
    const userMap = new Map(
      (users as any[]).map((u) => [normalizeId(u.id), { id: u.id, name: u.name, avatar: u.avatar }]),
    );

    const slots = await dutySlotsRepository.findAll();
    const slotMap = new Map((slots as any[]).map((s) => [normalizeId(s.id), s]));

    const data = result.data.map((req: any) => ({
      ...req,
      user: userMap.get(normalizeId(req.userId)),
      slot: slotMap.get(normalizeId(req.slotId)),
    }));

    return { ...result, data };
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
    const updated = await dutyLeaveRequestsRepository.update(requestId, {
      status,
      approvedBy: normalizeId(approverId),
      rejectionReason,
      updatedAt: now,
    });

    if (status === 'approved') {
      const slot = await dutySlotsRepository.findById(request.slotId);
      if (slot) {
        const assigned = normalizeIdList(slot.assignedUserIds || []);
        const nextAssigned = assigned.filter((id) => normalizeId(id) !== normalizeId(request.userId));
        await dutySlotsRepository.update(slot.id, {
          assignedUserIds: nextAssigned,
          updatedAt: now,
        });

        await dutyLogsRepository.create({
          type: 'leave',
          action: 'approved',
          requestId: normalizeId(requestId),
          slotId: slot.id,
          userId: request.userId,
          performerId: normalizeId(approverId),
          details: `Duyệt đơn nghỉ kíp: ${slot.shiftLabel || slot.id}`,
          createdAt: new Date(),
        });

        await notificationService.notifyUser(request.userId as number, {
          title: 'Đơn xin nghỉ đã được duyệt',
          message: `Yêu cầu xin nghỉ cho kíp ${slot.shiftLabel || ''} của bạn đã được chấp thuận.`,
          category: 'duty',
          type: 'leave',
          refId: request.id,
        });
      }
    } else if (status === 'rejected') {
      await dutyLogsRepository.create({
        type: 'leave',
        action: 'rejected',
        requestId: normalizeId(requestId),
        slotId: request.slotId,
        userId: request.userId,
        performerId: normalizeId(approverId),
        details: `Từ chối đơn nghỉ. Lý do: ${rejectionReason || 'Không có'}`,
        createdAt: new Date(),
      });

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
