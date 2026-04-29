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
    const toSlotId = normalizeId(payload.toSlotId || payload.dutySlotId || payload.slotId);
    const fromSlotId = normalizeId(payload.fromSlotId);
    const targetUserId = payload.targetUserId ? normalizeId(payload.targetUserId) : null;
    const reason = payload.reason || '';

    const toSlot = await dutySlotsRepository.findById(toSlotId);
    if (!toSlot) throw ApiError.notFound('Mục tiêu chuyển kíp không tồn tại');

    const fromSlot = await dutySlotsRepository.findById(fromSlotId);
    if (!fromSlot) throw ApiError.notFound('Kíp trực nguồn không tồn tại');

    const created = await dutySwapRequestsRepository.create({
      fromSlotId,
      toSlotId,
      requesterId: normalizeId(requesterUser.id),
      targetUserId: targetUserId,
      reason,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const toSlotLabel = await dutySlotsService.getSlotLabel(toSlot);
    const fromSlotLabel = await dutySlotsService.getSlotLabel(fromSlot);

    if (targetUserId) {
      await notificationService.notifyUser(targetUserId, {
        title: 'Yêu cầu đổi ca trực',
        message: `${requesterUser.name} muốn đổi ca với bạn: từ ${fromSlotLabel} sang ${toSlotLabel}`,
        category: 'swap',
        type: 'swap',
        refId: created.id,
      });
    } else {
      const admins = await usersRepository.findMany({ role: 'admin' });
      for (const admin of admins) {
        await notificationService.notifyUser(admin.id as number, {
          title: 'Yêu cầu chuyển ca trực',
          message: `${requesterUser.name} xin chuyển: từ ${fromSlotLabel} sang ${toSlotLabel}`,
          category: 'approval',
          type: 'approval',
          refId: created.id,
        });
      }
    }

    await dutyLogsService.log(
      'swap_transfer',
      'request',
      `Yêu cầu chuyển kíp: ${fromSlotLabel} -> ${toSlotLabel}. Lý do: ${reason}`,
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
      const targetSlot = await dutySlotsRepository.findById(req.toSlotId);
      if (!targetSlot) throw ApiError.notFound('Kíp trực đích không tồn tại');

      const requesterId = normalizeId(req.requesterId);

      // Handle Source Slot removal
      if (req.fromSlotId) {
        const sourceSlot = await dutySlotsRepository.findById(req.fromSlotId);
        if (sourceSlot) {
          const sourceAssigned = normalizeIdList(sourceSlot.assignedUserIds || []);
          const sourceConfig = sourceSlot.config || {};
          const sourceAdminAssigned = normalizeIdList(sourceConfig.adminAssignedUserIds || []);

          const isWasAdminAssigned = sourceAdminAssigned.includes(requesterId);

          await dutySlotsRepository.update(sourceSlot.id, {
            assignedUserIds: sourceAssigned.filter((id) => normalizeId(id) !== requesterId),
            config: {
              ...sourceConfig,
              adminAssignedUserIds: sourceAdminAssigned.filter((id) => normalizeId(id) !== requesterId),
            },
            updatedAt: new Date().toISOString(),
          });

          // Handle Target Slot addition with preserved nature
          const targetAssigned = normalizeIdList(targetSlot.assignedUserIds || []);
          const targetConfig = targetSlot.config || {};
          const targetAdminAssigned = normalizeIdList(targetConfig.adminAssignedUserIds || []);

          if (!targetAssigned.includes(requesterId)) {
            targetAssigned.push(requesterId as any);
          }

          // Preserve nature: Only add to adminAssigned if they were assigned in source
          if (isWasAdminAssigned && !targetAdminAssigned.includes(requesterId)) {
            targetAdminAssigned.push(requesterId as any);
          }

          // Auto-increase capacity if needed
          let newCapacity = targetSlot.capacity || 0;
          if (targetAssigned.length > newCapacity) {
            newCapacity = targetAssigned.length;
          }

          await dutySlotsRepository.update(targetSlot.id, {
            assignedUserIds: targetAssigned,
            capacity: newCapacity,
            config: {
              ...targetConfig,
              adminAssignedUserIds: targetAdminAssigned,
            },
            updatedAt: new Date().toISOString(),
          });
        }
      } else {
        // If no fromSlotId, just add to target (shouldn't happen in swap, but for safety)
        const targetAssigned = normalizeIdList(targetSlot.assignedUserIds || []);
        if (!targetAssigned.includes(requesterId)) targetAssigned.push(requesterId as any);
        await dutySlotsRepository.update(targetSlot.id, {
          assignedUserIds: targetAssigned,
          updatedAt: new Date().toISOString(),
        });
      }

      // Fetch users for descriptive logging
      const [performer, requester] = await Promise.all([
        usersRepository.findById(approverId),
        usersRepository.findById(requesterId),
      ]);

      // Log to Target Slot
      await dutyLogsService.log(
        'info',
        'transfer',
        `Admin ${performer?.name || 'Hệ thống'} đã điều chuyển ${requester?.name || 'Thành viên'} sang kíp này`,
        approverId,
        requesterId,
        targetSlot.id,
        requestId,
      );

      // Log to Source Slot if exists
      if (req.fromSlotId) {
        await dutyLogsService.log(
          'info',
          'transfer',
          `${requester?.name || 'Thành viên'} đã được điều chuyển sang kíp khác bởi ${performer?.name || 'Hệ thống'}`,
          approverId,
          requesterId,
          req.fromSlotId,
          requestId,
        );
      }

      await notificationService.notifyUser(req.requesterId as number, {
        title: 'Điều chuyển kíp trực thành công',
        message: `Bạn đã được điều chuyển sang kíp trực: ${await dutySlotsService.getSlotLabel(targetSlot)}.`,
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
        req.toSlotId,
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
    const { requesterId, fromSlotId, toSlotId, status = 'pending', reason = '' } = data;
    const request = await dutySwapRequestsRepository.create({
      requesterId: normalizeId(requesterId),
      fromSlotId: normalizeId(fromSlotId) || null,
      toSlotId: normalizeId(toSlotId),
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
      expand: options.expand || 'requester,targetUser,approver,fromSlot,toSlot',
      sort: options.sort || 'createdAt',
      order: options.order || 'desc',
      filter: isApprover
        ? options.filter
        : { ...options.filter, $or: [{ requesterId: userId }, { targetUserId: userId }] },
    });

    // Enrich slots with labels
    await Promise.all(
      result.data.map(async (req: any) => {
        if (req.fromSlot) {
          req.fromSlot.shiftLabel = await dutySlotsService.getSlotLabel(req.fromSlot);
        }
        if (req.toSlot) {
          req.toSlot.shiftLabel = await dutySlotsService.getSlotLabel(req.toSlot);
        }
      }),
    );

    return result;
  }
}

export default new DutySwapRequestsService();
