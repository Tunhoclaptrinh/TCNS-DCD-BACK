import BaseService from '@shared/common/base-service';
import meetingsRepository from '@modules/meetings/repositories/meetings.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import ApiError from '@utils/api-error';
import type { AnyRecord, Identifier } from '@app-types/common';

const RSVP_VALUES = new Set(['pending', 'accepted', 'declined']);
const STATUS_VALUES = new Set(['scheduled', 'completed', 'cancelled']);

function toNum(value: unknown) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function toId(value: unknown): Identifier {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? (value as Identifier) : parsed;
}

function toIso(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toStr(value: unknown, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

function normalizeIds(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value ? [value] : [];
  const set = new Set<number>();

  for (const item of raw) {
    const id = toNum(item);
    if (id && id > 0) set.add(id);
  }

  return [...set].sort((a, b) => a - b);
}

class MeetingService extends BaseService {
  constructor() {
    super('meetings', meetingsRepository);
  }

  canManage(user: AnyRecord = {}) {
    const p = Array.isArray(user.permissions) ? user.permissions : [];
    return user.role === 'admin' || p.includes('duty:manage') || p.includes('meeting:create:all');
  }

  normalizeStatus(value: unknown, fallback = 'scheduled') {
    const status = String(value || fallback).toLowerCase();
    return STATUS_VALUES.has(status) ? status : fallback;
  }

  normalizeRsvp(value: unknown, fallback = 'pending') {
    const status = String(value || fallback).toLowerCase();
    return RSVP_VALUES.has(status) ? status : fallback;
  }

  async resolveParticipantIds(participantIds: unknown, actorId: number) {
    let ids = normalizeIds(participantIds);

    if (ids.length === 0) ids = [actorId];
    if (!ids.includes(actorId)) ids.push(actorId);

    const users = await usersRepository.findMany({ id_in: ids });
    const exists = new Set(users.map((u) => Number(u.id)));
    const invalid = ids.filter((id) => !exists.has(id));

    if (invalid.length > 0) {
      throw ApiError.badRequest(`Không tìm thấy người dùng: ${invalid.join(', ')}`);
    }

    return ids.sort((a, b) => a - b);
  }

  buildConfirmations(ids: number[], source: unknown, creatorId: number) {
    const byUser = new Map<number, AnyRecord>();
    const now = new Date().toISOString();

    if (Array.isArray(source)) {
      for (const item of source) {
        const userId = toNum((item || {}).userId);
        if (!userId) continue;
        byUser.set(userId, item || {});
      }
    }

    return ids.map((userId) => {
      const current = byUser.get(userId) || {};
      const status = this.normalizeRsvp(current.status, userId === creatorId ? 'accepted' : 'pending');
      return {
        userId,
        status,
        reason: toStr(current.reason),
        respondedAt: current.respondedAt || (status === 'pending' ? null : now),
      };
    });
  }

  ensureReadable(meeting: AnyRecord, user: AnyRecord = {}) {
    if (this.canManage(user)) return;

    const userId = toNum(user.id);
    const participantIds = normalizeIds(meeting.participantIds);

    if (!userId || !participantIds.includes(userId)) {
      throw ApiError.forbidden('Bạn không có quyền xem cuộc họp này');
    }
  }

  async listMeetings(user: AnyRecord = {}, options: AnyRecord = {}) {
    const filter = { ...(options.filter || {}) };

    if (!this.canManage(user)) {
      const userId = toNum(user.id);
      if (!userId) throw ApiError.unauthorized('Người dùng không hợp lệ');
      filter.participantIds = userId;
    }

    return await this.repository.findAllAdvanced({
      ...options,
      filter,
      sort: options.sort || 'meetingAt,createdAt',
      order: options.order || 'desc,desc',
    });
  }

  async getMeetingById(id: Identifier, user: AnyRecord = {}) {
    const meeting = await this.repository.findById(toId(id));
    if (!meeting) throw ApiError.notFound('Không tìm thấy lịch họp');

    this.ensureReadable(meeting, user);
    return meeting;
  }

  async createMeeting(payload: AnyRecord = {}, actorId: Identifier) {
    const userId = toNum(actorId);
    if (!userId) throw ApiError.unauthorized('Người dùng không hợp lệ');

    const title = toStr(payload.title);
    const location = toStr(payload.location);
    const meetingAt = toIso(payload.meetingAt || payload.startAt || payload.dateTime);
    const endAt = toIso(payload.endAt || payload.endTime);

    if (!title) throw ApiError.badRequest('title là bắt buộc');
    if (!location) throw ApiError.badRequest('location là bắt buộc');
    if (!meetingAt) throw ApiError.badRequest('meetingAt không hợp lệ');
    if (endAt && new Date(endAt).getTime() < new Date(meetingAt).getTime()) {
      throw ApiError.badRequest('endAt phải lớn hơn hoặc bằng meetingAt');
    }

    const participantIds = await this.resolveParticipantIds(payload.participantIds, userId);
    const now = new Date().toISOString();

    const created = await this.repository.create({
      title,
      location,
      meetingAt,
      endAt,
      agenda: toStr(payload.agenda || payload.description),
      status: this.normalizeStatus(payload.status),
      participantIds,
      confirmations: this.buildConfirmations(participantIds, payload.confirmations, userId),
      note: toStr(payload.note),
      createdBy: userId,
      updatedBy: userId,
      createdAt: now,
      updatedAt: now,
    });

    const receivers = participantIds.filter((id) => id !== userId);
    if (receivers.length > 0) {
      await notificationService.notifyUsers(receivers, {
        title: 'Lịch họp mới',
        message: `Bạn có lịch họp mới: ${title}`,
        category: 'system',
        type: 'system',
        refId: created.id,
        metadata: { meetingId: created.id, meetingAt, location },
      });
    }

    await auditLogsService.log({
      userId,
      action: 'TAO_LICH_HOP',
      module: 'MEETINGS',
      description: `Tạo lịch họp: ${title}`,
      resourceId: String(created.id),
    });

    return created;
  }

  async updateMeeting(id: Identifier, payload: AnyRecord = {}, actorId: Identifier) {
    const userId = toNum(actorId);
    if (!userId) throw ApiError.unauthorized('Người dùng không hợp lệ');

    const meetingId = toId(id);
    const found = await this.repository.findById(meetingId);
    if (!found) throw ApiError.notFound('Không tìm thấy lịch họp');

    const meetingAt = payload.meetingAt !== undefined ? toIso(payload.meetingAt) : toIso(found.meetingAt);
    const endAt = payload.endAt !== undefined ? toIso(payload.endAt) : toIso(found.endAt);

    if (!meetingAt) throw ApiError.badRequest('meetingAt không hợp lệ');
    if (endAt && new Date(endAt).getTime() < new Date(meetingAt).getTime()) {
      throw ApiError.badRequest('endAt phải lớn hơn hoặc bằng meetingAt');
    }

    const participantIds =
      payload.participantIds !== undefined
        ? await this.resolveParticipantIds(payload.participantIds, userId)
        : normalizeIds(found.participantIds);

    const a = {
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
    };

    const u = {
      ...(payload.title !== undefined ? { title: toStr(payload.title) } : {}),
      ...(payload.location !== undefined ? { location: toStr(payload.location) } : {}),
      ...(payload.agenda !== undefined || payload.description !== undefined
        ? { agenda: toStr(payload.agenda || payload.description) }
        : {}),
      ...(payload.note !== undefined ? { note: toStr(payload.note) } : {}),
      ...(payload.status !== undefined ? { status: this.normalizeStatus(payload.status) } : {}),
      meetingAt,
      endAt,
      participantIds,
      confirmations: this.buildConfirmations(participantIds, found.confirmations, Number(found.createdBy) || userId),
      ...a,
    };

    const updated = await this.repository.update(meetingId, u);
    if (!updated) throw ApiError.notFound('Không thể cập nhật lịch họp');

    await auditLogsService.log({
      userId,
      action: 'CAP_NHAT_LICH_HOP',
      module: 'MEETINGS',
      description: `Cập nhật lịch họp #${updated.id}`,
      resourceId: String(updated.id),
    });

    return updated;
  }

  async deleteMeeting(id: Identifier, actorId: Identifier) {
    const userId = toNum(actorId);
    if (!userId) throw ApiError.unauthorized('Người dùng không hợp lệ');

    const meetingId = toId(id);
    const found = await this.repository.findById(meetingId);
    if (!found) throw ApiError.notFound('Không tìm thấy lịch họp');

    await this.repository.delete(meetingId);

    await auditLogsService.log({
      userId,
      action: 'XOA_LICH_HOP',
      module: 'MEETINGS',
      description: `Xóa lịch họp #${meetingId}`,
      resourceId: String(meetingId),
    });

    return { success: true, id: meetingId };
  }

  async rsvpMeeting(id: Identifier, payload: AnyRecord = {}, user: AnyRecord = {}) {
    const userId = toNum(user.id);
    if (!userId) throw ApiError.unauthorized('Người dùng không hợp lệ');

    const meetingId = toId(id);
    const meeting = await this.repository.findById(meetingId);
    if (!meeting) throw ApiError.notFound('Không tìm thấy lịch họp');

    const participantIds = normalizeIds(meeting.participantIds);
    if (!participantIds.includes(userId)) participantIds.push(userId);

    const status = this.normalizeRsvp(payload.status || payload.response, '');
    if (!status || status === 'pending') {
      throw ApiError.badRequest("status phải là 'accepted' hoặc 'declined'");
    }

    const reason = toStr(payload.reason);
    if (status === 'declined' && !reason) {
      throw ApiError.badRequest('Vui lòng nhập lý do khi từ chối tham gia');
    }

    const now = new Date().toISOString();
    const confirmations = this.buildConfirmations(
      participantIds,
      meeting.confirmations,
      Number(meeting.createdBy) || userId,
    ).map((item) => (item.userId === userId ? { ...item, status, reason, respondedAt: now } : item));

    const a = { updatedBy: userId, updatedAt: now };
    const updated = await this.repository.update(meetingId, { participantIds, confirmations, ...a });
    if (!updated) throw ApiError.notFound('Không thể ghi nhận RSVP');

    const creatorId = toNum(meeting.createdBy);
    if (creatorId && creatorId !== userId) {
      await notificationService.notifyUser(creatorId, {
        title: 'Cập nhật RSVP họp',
        message: `${user.name || user.email || `#${userId}`} đã ${status === 'accepted' ? 'tham gia' : 'từ chối'} cuộc họp "${meeting.title}".`,
        category: 'system',
        type: 'system',
        refId: meeting.id,
        metadata: { meetingId: meeting.id, userId, status, reason },
      });
    }

    return updated;
  }
}

export default new MeetingService();
