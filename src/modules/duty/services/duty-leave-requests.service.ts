import BaseService from '@shared/common/base-service';
import dutyLeaveRequestsRepository from '@modules/duty/repositories/duty-leave-requests.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutyKipsRepository from '@modules/duty/repositories/duty-kips.repository';
import dutyShiftsRepository from '@modules/duty/repositories/duty-shifts.repository';
import notificationService from '@modules/notifications/services/notification.service';
import ApiError from '@utils/api-error';
import { Identifier, GenericRecord, normalizeId, normalizeIdList } from './duty-utils';
import dutyLogsService from './duty-logs.service';
import dutySlotsService from './duty-slots.service';
import usersRepository from '@modules/users/repositories/users.repository';

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
    const userId = normalizeId(data.userId);
    const slotId = normalizeId(data.slotId);

    const slot = await dutySlotsRepository.findById(slotId);
    if (!slot) throw ApiError.notFound('Kíp trực không tồn tại');

    const assigned = normalizeIdList(slot.assignedUserIds || []);
    const attended = normalizeIdList(slot.attendedUserIds || []);

    if (!assigned.includes(userId) && !attended.includes(userId)) {
      throw ApiError.badRequest('Bạn không có tên trong danh sách kíp trực này');
    }

    if (attended.includes(userId)) {
      throw ApiError.badRequest('Bạn đã được điểm danh trong kíp trực này, không thể gửi đơn xin nghỉ.');
    }

    return {
      ...base,
      userId,
      slotId,
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

  async enrichSlotDetails(rawSlot: any, slotId?: Identifier) {
    let slot = rawSlot;
    const targetSlotId = slot?.id || slotId;
    if ((!slot || !slot.shiftDate || (!slot.startTime && !slot.kipId)) && targetSlotId) {
      const fetched = await dutySlotsRepository.findById(targetSlotId);
      if (fetched) {
        slot = { ...fetched, ...(slot || {}) };
      }
    }
    if (!slot) return null;

    let kip = slot.kip;
    if (!kip && slot.kipId) {
      kip = await dutyKipsRepository.findById(slot.kipId);
    }
    let shift = slot.shift;
    if (!shift && (kip?.shiftId || slot.shiftId)) {
      shift = await dutyShiftsRepository.findById(kip?.shiftId || slot.shiftId);
    }

    const shiftName = shift?.name || slot.shiftName || undefined;
    const kipName = kip?.name || slot.kipName || undefined;
    const startTime = slot.startTime || kip?.startTime || shift?.startTime || undefined;
    const endTime = slot.endTime || kip?.endTime || shift?.endTime || undefined;

    let shiftLabel = undefined;
    if (shiftName && kipName) {
      shiftLabel = `${shiftName} • ${kipName}`;
    } else if (shiftName || kipName) {
      shiftLabel = shiftName || kipName;
    }

    let assignedUsers = slot.assignedUsers || [];
    if ((!assignedUsers || assignedUsers.length === 0) && slot.assignedUserIds?.length > 0) {
      const usersList = await usersRepository.findMany({ id_in: slot.assignedUserIds });
      if (Array.isArray(usersList)) {
        assignedUsers = usersList;
      }
    }

    return {
      ...slot,
      kip,
      shift,
      shiftName,
      kipName,
      startTime,
      endTime,
      shiftLabel,
      assignedUsers,
    };
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

    // Enrich slots and users
    if (result.data) {
      const userIdsToFetch = new Set<number>();
      result.data.forEach((req: any) => {
        if ((!req.user || (!req.user.name && !req.user.lastName && !req.user.firstName)) && req.userId) {
          userIdsToFetch.add(Number(req.userId));
        }
        if (
          (!req.approver || (!req.approver.name && !req.approver.lastName && !req.approver.firstName)) &&
          req.approvedBy
        ) {
          userIdsToFetch.add(Number(req.approvedBy));
        }
      });

      const userMap = new Map<number, any>();
      if (userIdsToFetch.size > 0) {
        const usersList = await usersRepository.findMany({ id_in: Array.from(userIdsToFetch) });
        if (Array.isArray(usersList)) {
          usersList.forEach((u: any) => userMap.set(Number(u.id), u));
        }
      }

      await Promise.all(
        result.data.map(async (req: any) => {
          if ((!req.user || (!req.user.name && !req.user.lastName && !req.user.firstName)) && req.userId) {
            req.user = userMap.get(Number(req.userId)) || req.user || null;
          }
          if (
            (!req.approver || (!req.approver.name && !req.approver.lastName && !req.approver.firstName)) &&
            req.approvedBy
          ) {
            req.approver = userMap.get(Number(req.approvedBy)) || req.approver || null;
          }
          req.slot = await this.enrichSlotDetails(req.slot, req.slotId);
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
