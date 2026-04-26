import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, normalizeIdList } from './duty-utils';
import dutyLogsService from './duty-logs.service';
import dutySlotsService from './duty-slots.service';

class DutyLeaveRequestsService {
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
    const updated = await dutyLeaveRequestsRepository.update(id, { ...data, updatedAt: new Date().toISOString() });
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

    const [users, slots] = await Promise.all([usersRepository.findAll(), dutySlotsRepository.findAll()]);
    const userMap = new Map(
      (users as any[]).map((u) => [normalizeId(u.id), { id: u.id, name: u.name, avatar: u.avatar }]),
    );
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
