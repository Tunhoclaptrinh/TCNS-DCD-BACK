import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, normalizeIdList } from './duty-utils';
import dutyLogsService from './duty-logs.service';
import dutySlotsService from './duty-slots.service';

class DutySwapRequestsService {
  async requestSwap(payload: GenericRecord, requesterUser: GenericRecord) {
    const toSlotId = normalizeId(payload.slotId || payload.dutySlotId || payload.toSlotId);
    const fromSlotId = payload.fromSlotId ? normalizeId(payload.fromSlotId) : null;
    const targetUserId = payload.targetUserId ? normalizeId(payload.targetUserId) : null;

    const toSlot = await dutySlotsRepository.findById(toSlotId);
    if (!toSlot) throw ApiError.notFound('Mục tiêu chuyển kíp không tồn tại');

    const created = await dutySwapRequestsRepository.create({
      dutySlotId: toSlotId,
      fromSlotId: fromSlotId,
      requesterId: normalizeId(requesterUser.id),
      targetUserId: targetUserId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (targetUserId) {
      await notificationService.notifyUser(targetUserId, {
        title: 'Yêu cầu đổi ca trực',
        message: `${requesterUser.name} muốn đổi ca với bạn: ${toSlot.shiftLabel}`,
        category: 'swap',
        type: 'swap',
        refId: created.id,
      });
    } else {
      const admins = await usersRepository.findMany({ role: 'admin' });
      for (const admin of admins) {
        await notificationService.notifyUser(admin.id as number, {
          title: 'Yêu cầu chuyển ca trực',
          message: `${requesterUser.name} xin chuyển sang: ${toSlot.shiftLabel}`,
          category: 'approval',
          type: 'approval',
          refId: created.id,
        });
      }
    }

    await dutyLogsService.log(
      'swap_transfer',
      'request',
      `Yêu cầu đổi/chuyển kíp: ${toSlot.shiftLabel}. ${fromSlotId ? `Từ kíp #${fromSlotId}` : 'Chuyển mới'}.`,
      requesterUser.id,
      requesterUser.id,
      toSlotId,
      created.id,
    );

    return created;
  }

  async decideSwap(requestId: Identifier, payload: GenericRecord = {}, approver: any) {
    const req = await dutySwapRequestsRepository.findById(requestId);
    if (!req) throw ApiError.notFound('Yêu cầu không tồn tại');

    const status = payload.status || payload.decision;
    const approverId = normalizeId(approver?.id || approver);
    const approverObj =
      typeof approver === 'object' && approver.role ? approver : await usersRepository.findById(approverId);
    if (!approverObj) throw ApiError.notFound('Người duyệt không tồn tại');

    const isTargetUser = normalizeId(req.targetUserId) === approverId;
    const isAdminOrStaff = ['admin', 'staff'].includes(approverObj.role as string);

    if (!isTargetUser && !isAdminOrStaff) throw ApiError.forbidden('Bạn không có quyền xử lý yêu cầu này');

    if (status === 'approved') {
      const targetSlot = await dutySlotsRepository.findById(req.dutySlotId);
      if (!targetSlot) throw ApiError.notFound('Kíp trực đích không tồn tại');

      if (req.fromSlotId) {
        const sourceSlot = await dutySlotsRepository.findById(req.fromSlotId);
        if (sourceSlot) {
          const sourceAssigned = normalizeIdList(sourceSlot.assignedUserIds || []);
          await dutySlotsRepository.update(sourceSlot.id, {
            assignedUserIds: sourceAssigned.filter((id) => normalizeId(id) !== normalizeId(req.requesterId)),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      const targetAssigned = normalizeIdList(targetSlot.assignedUserIds || []);
      if (!targetAssigned.includes(normalizeId(req.requesterId)))
        targetAssigned.push(normalizeId(req.requesterId) as any);

      await dutySlotsRepository.update(targetSlot.id, {
        assignedUserIds: targetAssigned,
        updatedAt: new Date().toISOString(),
      });

      const targetLabel = await dutySlotsService.getSlotLabel(targetSlot);
      await dutyLogsService.log(
        'swap_transfer',
        'transfer',
        `Điều chuyển nhân sự: ${req.requesterId}. Lộ trình: ${req.fromSlotId ? `Kíp #${req.fromSlotId}` : 'N/A'} -> ${targetLabel} (#${targetSlot.id})`,
        approverId,
        req.requesterId,
        targetSlot.id,
        requestId,
      );

      await notificationService.notifyUser(req.requesterId as number, {
        title: 'Điều chuyển kíp trực thành công',
        message: `Bạn đã được điều chuyển sang kíp trực: ${targetLabel}.`,
        category: 'duty',
        type: 'swap',
        refId: req.id,
      });
    } else if (status === 'rejected') {
      await notificationService.notifyUser(req.requesterId as number, {
        title: 'Yêu cầu đổi ca bị từ chối',
        message: `Yêu cầu đổi ca của bạn đã được từ chối.`,
        category: 'duty',
        type: 'swap',
        refId: req.id,
      });

      await dutyLogsService.log(
        'swap_transfer',
        'rejected',
        `Từ chối yêu cầu đổi/chuyển kíp của nhân sự: ${req.requesterId}.`,
        approverId,
        req.requesterId,
        req.dutySlotId,
        requestId,
      );
    }

    return await dutySwapRequestsRepository.update(requestId, {
      status,
      approvedBy: approverId,
      decisionNote: payload.reason || payload.decisionNote || '',
      updatedAt: new Date().toISOString(),
    });
  }

  async createSwapManual(data: GenericRecord, performerId: Identifier) {
    const { requesterId, fromSlotId, dutySlotId, status = 'pending', reason = '' } = data;
    const request = await dutySwapRequestsRepository.create({
      requesterId: normalizeId(requesterId),
      fromSlotId: normalizeId(fromSlotId) || null,
      dutySlotId: normalizeId(dutySlotId),
      status,
      reason,
      approvedBy: status === 'approved' ? normalizeId(performerId) : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    if (status === 'approved') {
      await this.decideSwap(request.id, { decision: 'approved', reason }, performerId);
    }
    return request;
  }

  async updateSwapRequest(id: Identifier, data: GenericRecord, performerId: Identifier) {
    const old = await dutySwapRequestsRepository.findById(id);
    if (!old) throw ApiError.notFound('Mục không tồn tại');
    const updated = await dutySwapRequestsRepository.update(id, { ...data, updatedAt: new Date().toISOString() });
    if (data.status === 'approved' && old.status !== 'approved') {
      await this.decideSwap(id, { decision: 'approved', reason: data.reason || '' }, performerId);
    }
    return updated;
  }

  async deleteSwapRequest(id: Identifier) {
    return await dutySwapRequestsRepository.delete(id);
  }

  async getSwapRequests(user: GenericRecord, options: GenericRecord = {}) {
    const userId = normalizeId(user.id);
    const isApprover = ['admin', 'staff'].includes(user.role);

    const result = await dutySwapRequestsRepository.findAllAdvanced({
      ...options,
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
      filter: isApprover
        ? options.filter
        : { ...options.filter, $or: [{ requesterId: userId }, { targetUserId: userId }] },
    });

    const [users, slots] = await Promise.all([usersRepository.findAll(), dutySlotsRepository.findAll()]);
    const userMap = new Map(
      (users as any[]).map((u) => [normalizeId(u.id), { id: u.id, name: u.name, avatar: u.avatar }]),
    );
    const slotMap = new Map((slots as any[]).map((s) => [normalizeId(s.id), s]));

    const data = result.data.map((req: any) => ({
      ...req,
      requester: userMap.get(normalizeId(req.requesterId)),
      targetUser: userMap.get(normalizeId(req.targetUserId)),
      slot: slotMap.get(normalizeId(req.dutySlotId)),
    }));

    return { ...result, data };
  }
}

export default new DutySwapRequestsService();
