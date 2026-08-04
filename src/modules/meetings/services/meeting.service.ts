import BaseService from '@shared/common/base-service';
import meetingsRepository from '@modules/meetings/repositories/meetings.repository';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationService from '@modules/notifications/services/notification.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import ApiError from '@utils/api-error';
import type { AnyRecord, Identifier } from '@app-types/common';

const RSVP_VALUES = new Set(['pending', 'accepted', 'declined']);
const ATTENDANCE_VALUES = new Set(['none', 'present', 'late', 'absent']);
const STATUS_VALUES = new Set(['scheduled', 'completed', 'cancelled', 'overdue']);

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
    return p.includes('*') || p.includes('duty:manage') || p.includes('meeting:create:all');
  }

  normalizeStatus(value: unknown, fallback = 'scheduled') {
    const status = String(value || fallback).toLowerCase();
    return STATUS_VALUES.has(status) ? status : fallback;
  }

  normalizeRsvp(value: unknown, fallback = 'pending') {
    const status = String(value || fallback).toLowerCase();
    return RSVP_VALUES.has(status) ? status : fallback;
  }

  normalizeAttendance(value: unknown, fallback = 'none') {
    const status = String(value || fallback).toLowerCase();
    return ATTENDANCE_VALUES.has(status) ? status : fallback;
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

  async populateParticipants(meeting: AnyRecord) {
    if (!meeting) return meeting;
    const ids = normalizeIds(meeting.participantIds);
    if (ids.length === 0) return { ...meeting, participants: [] };

    const users = await usersRepository.findMany({ id_in: ids });
    const userMap = new Map(
      users.map((u) => [
        Number(u.id),
        {
          id: u.id,
          name: u.name,
          avatar: u.avatar,
          studentId: u.studentId,
          email: u.email,
          department: u.department,
          position: u.position,
        },
      ]),
    );

    return {
      ...meeting,
      participants: ids.map((id) => userMap.get(id) || { id, name: `Thành viên #${id}` }),
    };
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
      const rsvpStatus = this.normalizeRsvp(current.rsvpStatus || current.status, 'pending');
      const attendanceStatus = this.normalizeAttendance(current.attendanceStatus, 'none');

      return {
        userId,
        rsvpStatus,
        attendanceStatus,
        reason: toStr(current.reason),
        respondedAt: current.respondedAt || (rsvpStatus === 'pending' ? null : now),
      };
    });
  }

  ensureReadable(meeting: AnyRecord, user: AnyRecord = {}) {
    if (this.canManage(user)) return;

    if (meeting.visibility === 'public') return;

    if (meeting.visibility === 'members' && user.position && user.position !== 'ctv') return;

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

      const visibilityConditions: any[] = [{ visibility: 'public' }];

      if (user.position && user.position !== 'ctv') {
        visibilityConditions.push({ visibility: 'members' });
      }

      filter.$or = [...visibilityConditions, { participantIds: userId }];
    }

    const result = await this.repository.findAllAdvanced({
      ...options,
      filter,
      sort: options.sort || 'meetingAt,createdAt',
      order: options.order || 'desc,desc',
    });

    result.data = await Promise.all((result.data || []).map((m) => this.populateParticipants(m)));
    return result;
  }

  async getMeetingStats(user: AnyRecord = {}, options: AnyRecord = {}) {
    const filter: AnyRecord = { ...(options.filter || {}) };

    if (!this.canManage(user)) {
      const userId = toNum(user.id);
      if (!userId) throw ApiError.unauthorized('Người dùng không hợp lệ');

      const visibilityConditions: any[] = [{ visibility: 'public' }];

      if (user.position && user.position !== 'ctv') {
        visibilityConditions.push({ visibility: 'members' });
      }

      filter.$or = [...visibilityConditions, { participantIds: userId }];
    }

    const meetings = await this.repository.findMany(filter);

    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let upcoming = 0;
    let pendingRsvp = 0;
    let totalMonth = 0;
    let overdue = 0;

    for (const m of meetings) {
      if (m.status === 'scheduled') upcoming++;
      if (m.status === 'overdue') overdue++;

      const mDate = new Date(m.meetingAt);
      if (mDate.getMonth() === currentMonth && mDate.getFullYear() === currentYear) {
        totalMonth++;
      }

      if (m.status === 'scheduled') {
        const isInvited = m.isAllParticipants || (m.participantIds && m.participantIds.includes(Number(user.id)));
        const myConfirm = m.confirmations?.find((c: any) => Number(c.userId) === Number(user.id));
        const rsvpStatus = String(myConfirm?.rsvpStatus || 'pending').toLowerCase();
        if (isInvited && rsvpStatus === 'pending') {
          pendingRsvp++;
        }
      }
    }

    return { upcoming, pendingRsvp, totalMonth, overdue };
  }

  async getMeetingById(id: Identifier, user: AnyRecord = {}) {
    const meeting = await this.repository.findById(toId(id));
    if (!meeting) throw ApiError.notFound('Không tìm thấy lịch họp');

    this.ensureReadable(meeting, user);
    return await this.populateParticipants(meeting);
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

    let participantIds: number[] = [];
    const isAll = payload.isAllParticipants === true || payload.isAllParticipants === 'true';

    if (isAll) {
      const allUsers = await usersRepository.findAllAdvanced({
        pageSize: 2000,
        filter: { status: 'active' },
      });
      participantIds = (allUsers.data || []).map((u: AnyRecord) => Number(u.id));
    } else {
      participantIds = await this.resolveParticipantIds(payload.participantIds, userId);
    }

    const now = new Date().toISOString();

    const created = await this.repository.create({
      title,
      location,
      meetingAt,
      endAt,
      agenda: toStr(payload.agenda || payload.description),
      status: this.normalizeStatus(payload.status),
      participantIds,
      isAllParticipants: isAll,
      visibility: payload.visibility === 'public' ? 'public' : 'private',
      confirmations: this.buildConfirmations(participantIds, payload.confirmations, userId),
      note: toStr(payload.note),
      createdBy: userId,
      updatedBy: userId,
    });

    const receivers = participantIds.filter((id) => id !== userId);
    if (receivers.length > 0) {
      // Fire-and-forget: Chạy ngầm, không block API
      notificationService
        .notifyUsers(receivers, {
          title: 'Lịch họp mới',
          message: `Bạn có lịch họp mới: ${title}`,
          category: 'system',
          type: 'system',
          refId: created.id,
          metadata: { meetingId: created.id, meetingAt, location },
        })
        .catch((err) => console.error('Lỗi khi gửi thông báo lịch họp:', err));
    }

    await auditLogsService.log({
      userId,
      action: 'TAO_LICH_HOP',
      module: 'MEETINGS',
      description: `Tạo lịch họp: ${title}`,
      resourceId: String(created.id),
    });

    return await this.populateParticipants(created);
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

    const isAll =
      payload.isAllParticipants !== undefined
        ? payload.isAllParticipants === true || payload.isAllParticipants === 'true'
        : !!found.isAllParticipants;

    let participantIds: number[];
    if (payload.isAllParticipants !== undefined || payload.participantIds !== undefined) {
      if (isAll) {
        const allUsers = await usersRepository.findAllAdvanced({
          pageSize: 2000,
          filter: { status: 'active' },
        });
        participantIds = (allUsers.data || []).map((u: AnyRecord) => Number(u.id));
      } else {
        participantIds = await this.resolveParticipantIds(payload.participantIds, userId);
      }
    } else {
      participantIds = normalizeIds(found.participantIds);
    }

    const a = {
      updatedBy: userId,
    };

    const finalConfirmations = this.buildConfirmations(
      participantIds,
      found.confirmations,
      Number(found.createdBy) || userId,
    );

    // Sync attendance from minutes or batch update
    if (payload.attendanceUpdates || Array.isArray(payload.presentIds) || Array.isArray(payload.absentIds)) {
      const updates = payload.attendanceUpdates || {};
      const presentSet = new Set(normalizeIds(payload.presentIds));
      const absentSet = new Set(normalizeIds(payload.absentIds));

      finalConfirmations.forEach((c) => {
        const cid = Number(c.userId);

        // Priority 1: Direct attendanceUpdates map
        if (updates[cid]) {
          c.attendanceStatus = this.normalizeAttendance(updates[cid], 'none');
        }
        // Priority 2: presentIds/absentIds (from minutes modal)
        else if (presentSet.has(cid)) {
          c.attendanceStatus = 'present';
        } else if (absentSet.has(cid)) {
          c.attendanceStatus = 'absent';
        }
      });
    }

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
      isAllParticipants: isAll,
      ...(payload.visibility !== undefined
        ? { visibility: payload.visibility === 'public' ? 'public' : 'private' }
        : {}),
      confirmations: finalConfirmations,
      ...(payload.minutesContent !== undefined ? { minutesContent: toStr(payload.minutesContent) } : {}),
      ...(payload.chairpersonIds !== undefined ? { chairpersonIds: normalizeIds(payload.chairpersonIds) } : {}),
      ...(payload.secretaryIds !== undefined ? { secretaryIds: normalizeIds(payload.secretaryIds) } : {}),
      ...(payload.opinions !== undefined ? { opinions: toStr(payload.opinions) } : {}),
      ...(payload.proposals !== undefined ? { proposals: toStr(payload.proposals) } : {}),
      ...(payload.minutesStatus !== undefined ? { minutesStatus: payload.minutesStatus } : {}),
      ...(payload.otherChairpersons !== undefined
        ? {
            otherChairpersons: Array.isArray(payload.otherChairpersons)
              ? payload.otherChairpersons.map(String).filter((s) => s.trim())
              : [],
          }
        : {}),
      ...(payload.otherSecretaries !== undefined
        ? {
            otherSecretaries: Array.isArray(payload.otherSecretaries)
              ? payload.otherSecretaries.map(String).filter((s) => s.trim())
              : [],
          }
        : {}),
      ...(payload.otherPresent !== undefined
        ? {
            otherPresent: Array.isArray(payload.otherPresent)
              ? payload.otherPresent.map(String).filter((s) => s.trim())
              : [],
          }
        : {}),
      ...(payload.otherAbsent !== undefined
        ? {
            otherAbsent: Array.isArray(payload.otherAbsent)
              ? payload.otherAbsent.map(String).filter((s) => s.trim())
              : [],
          }
        : {}),
      ...a,
    };

    // Track minutes history
    const isMinutesChanging =
      payload.minutesContent !== undefined ||
      payload.minutesStatus !== undefined ||
      payload.chairpersonIds !== undefined ||
      payload.secretaryIds !== undefined ||
      payload.otherChairpersons !== undefined ||
      payload.otherSecretaries !== undefined ||
      payload.otherPresent !== undefined ||
      payload.otherAbsent !== undefined;

    if (isMinutesChanging) {
      const historyEntry = {
        userId,
        action: payload.minutesStatus === 'submitted' ? 'Nộp biên bản' : 'Lưu nháp biên bản',
        timestamp: new Date().toISOString(),
        note: payload.minutesStatus === 'submitted' ? 'Cập nhật nội dung chính thức' : 'Chỉnh sửa nội dung nháp',
      };
      (u as any).minutesHistory = [...(found.minutesHistory || []), historyEntry];
    }

    const updated = await this.repository.update(meetingId, u);
    if (!updated) throw ApiError.notFound('Không thể cập nhật lịch họp');

    await auditLogsService.log({
      userId,
      action: 'CAP_NHAT_LICH_HOP',
      module: 'MEETINGS',
      description: `Cập nhật lịch họp #${updated.id}`,
      resourceId: String(updated.id),
    });

    return await this.populateParticipants(updated);
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

    const rsvpStatus = this.normalizeRsvp(payload.rsvpStatus || payload.status || payload.response, '');
    if (!rsvpStatus || rsvpStatus === 'pending') {
      throw ApiError.badRequest("rsvpStatus phải là 'accepted' hoặc 'declined'");
    }

    const reason = toStr(payload.reason);
    if (rsvpStatus === 'declined' && !reason) {
      throw ApiError.badRequest('Vui lòng nhập lý do khi từ chối tham gia');
    }

    const now = new Date().toISOString();
    const confirmations = this.buildConfirmations(
      participantIds,
      meeting.confirmations,
      Number(meeting.createdBy) || userId,
    ).map((item) => (item.userId === userId ? { ...item, rsvpStatus, reason, respondedAt: now } : item));

    const a = { updatedBy: userId };
    const updated = await this.repository.update(meetingId, { participantIds, confirmations, ...a });
    if (!updated) throw ApiError.notFound('Không thể ghi nhận RSVP');

    const creatorId = toNum(meeting.createdBy);
    if (creatorId && creatorId !== userId) {
      await notificationService.notifyUser(creatorId, {
        title: 'Cập nhật RSVP họp',
        message: `${user.name || user.email || `#${userId}`} đã ${rsvpStatus === 'accepted' ? 'tham gia' : 'từ chối'} cuộc họp "${meeting.title}".`,
        category: 'system',
        type: 'system',
        refId: meeting.id,
        metadata: { meetingId: meeting.id, userId, rsvpStatus, reason },
      });
    }

    return await this.populateParticipants(updated);
  }

  async markAttendance(payload: AnyRecord = {}, actor: AnyRecord = {}) {
    const meetingId = toId(payload.meetingId);
    const userId = toNum(payload.userId);
    const attendanceStatus = toStr(payload.attendanceStatus || payload.status);
    const reason = toStr(payload.reason);

    if (!meetingId) throw ApiError.badRequest('meetingId là bắt buộc');
    if (!userId) throw ApiError.badRequest('userId là bắt buộc');
    if (!attendanceStatus) throw ApiError.badRequest('attendanceStatus là bắt buộc');

    const meeting = await this.repository.findById(meetingId);
    if (!meeting) throw ApiError.notFound('Không tìm thấy lịch họp');

    if (!this.canManage(actor)) throw ApiError.forbidden('Bạn không có quyền điểm danh');

    const participantIds = normalizeIds(meeting.participantIds);
    if (!participantIds.includes(userId)) participantIds.push(userId);

    const now = new Date().toISOString();
    const confirmations = this.buildConfirmations(
      participantIds,
      meeting.confirmations,
      Number(meeting.createdBy) || userId,
    ).map((c) => (String(c.userId) === String(userId) ? { ...c, attendanceStatus, reason } : c));

    const updated = await this.repository.update(meetingId, {
      participantIds,
      confirmations,
      updatedBy: toNum(actor.id),
    });

    return await this.populateParticipants(updated);
  }
}

export default new MeetingService();
