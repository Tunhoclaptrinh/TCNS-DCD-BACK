import BaseService from '@shared/common/base-service';
import db from '@database/mongo-database.adapter';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationsRepository from '@modules/notifications/repositories/notifications.repository';
import rewardPenaltiesRepository from '@modules/reward-penalties/repositories/reward-penalties.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import { hashPassword } from '@utils/auth.utils';
import { sanitizeUser } from '@utils/user.utils';
import ApiError from '@utils/api-error';
import userSchema from '@modules/users/schemas/user.schema';
import notificationService from '@modules/notifications/services/notification.service';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import { getSuggestedRoles } from '../utils/user-mapping.utils';
import type { AnyRecord, Identifier } from '@app-types/common';

function generateAvatarUrl(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
}

type UserRecord = {
  id: Identifier;
  role?: string;
  expelled?: boolean;
  isActive?: boolean;
  position?: string;
  status?: string;
  department?: string;
  createdAt?: string;
  lastLogin?: string;
  name?: string;
  avatar?: string;
  firstName?: string;
  lastName?: string;
};
type UserStatItem = {
  total: number;
  active: number;
  inactive: number;
  dismissed: number;
  ctv: number;
  official: number;
  management: number;
  alumni: number;
  recentSignups: number;
  byRole: Record<string, number>;
  byPosition: Record<string, number>;
  byGeneration: Record<string, number>;
};
type UserStats = {
  global: UserStatItem;
  byDepartment: Record<string, UserStatItem>;
};

function createUserStatItem(): UserStatItem {
  return {
    total: 0,
    active: 0,
    inactive: 0,
    dismissed: 0,
    ctv: 0,
    official: 0,
    management: 0,
    alumni: 0,
    recentSignups: 0,
    byRole: {},
    byPosition: {},
    byGeneration: {},
  };
}

function processUserStats(item: UserStatItem, user: any, weekAgo: Date) {
  item.total++;

  // Status-based stats
  if (user.status === 'active') {
    item.active++;
    // Only 'ctv' is considered collaborator, others are official members
    if (user.position === 'ctv') {
      item.ctv++;
    } else {
      item.official++;
    }
  } else if (user.status === 'inactive') {
    item.inactive++;
    item.alumni++;
  } else if (user.status === 'dismissed') {
    item.dismissed++;
  }

  // Management stats: dt, ctc, tb, pb
  const isManagement = ['ctc', 'dt', 'tb', 'pb'].includes(user.position);
  if (isManagement) {
    item.management++;
  }

  if (user.createdAt && new Date(user.createdAt) >= weekAgo) item.recentSignups++;

  if (user.role) {
    item.byRole[user.role] = (item.byRole[user.role] || 0) + 1;
  }

  if (user.position) {
    item.byPosition[user.position] = (item.byPosition[user.position] || 0) + 1;
  }

  if (user.generationId) {
    const genId = String(user.generationId);
    item.byGeneration[genId] = (item.byGeneration[genId] || 0) + 1;
  }
}

function getAssignedUserIds(slot: { assignedUserIds?: Identifier[] }): Identifier[] {
  return slot.assignedUserIds || [];
}

class UserService extends BaseService {
  constructor() {
    super('users', usersRepository);
  }

  normalizeUserId(userId: Identifier) {
    const parsedUserId = Number(userId);
    return Number.isNaN(parsedUserId) ? userId : parsedUserId;
  }

  extractActorId(actor?: AnyRecord | Identifier) {
    if (actor && typeof actor === 'object') {
      return actor.id as Identifier;
    }

    return actor;
  }

  toAuditUserId(actor?: AnyRecord | Identifier, fallback?: Identifier) {
    const candidate = this.extractActorId(actor) ?? fallback;
    const normalized = Number(candidate);
    return Number.isFinite(normalized) ? normalized : 0;
  }

  getUserDisplayName(user: AnyRecord = {}) {
    return String(user.name || user.email || user.studentId || user.id || 'unknown');
  }

  async create(data: AnyRecord, performer?: AnyRecord | Identifier) {
    if (data.position && ['dt', 'ctc', 'ctv', 'tv'].includes(data.position as string)) {
      data.department = null;
    }

    if (data.position && data.roleIds === undefined) {
      data.roleIds = getSuggestedRoles(data.position as string, data.department as string);
    }

    const result = await super.create(data);

    if (result.success && result.data) {
      const createdUser = result.data as AnyRecord;
      await auditLogsService.log({
        userId: this.toAuditUserId(performer, createdUser.id as Identifier),
        action: 'THÊM NGƯỜI DÙNG',
        module: 'USERS',
        description: `Tạo người dùng ${this.getUserDisplayName(createdUser)}`,
        resourceId: String(createdUser.id),
      });
    }

    return result;
  }

  async update(id: Identifier, data: AnyRecord, performer?: AnyRecord | Identifier) {
    const existingUser = (await this.repository.findById(id)) as UserRecord;
    if (existingUser) {
      const position = data.position !== undefined ? data.position : existingUser.position;
      let department = data.department !== undefined ? data.department : existingUser.department;

      if (position && ['dt', 'ctc', 'ctv', 'tv'].includes(position as string)) {
        data.department = null;
        department = null;
      }

      // Tự động đồng bộ quyền nếu có thay đổi chức vụ mà không truyền roleIds
      if (data.position !== undefined && data.roleIds === undefined) {
        data.roleIds = getSuggestedRoles(position as string, department as string);
      }
    }

    const result = await super.update(id, data);

    if (result.success && result.data) {
      const updatedUser = result.data as AnyRecord;
      await auditLogsService.log({
        userId: this.toAuditUserId(performer, updatedUser.id as Identifier),
        action: 'CẬP NHẬT NGƯỜI DÙNG',
        module: 'USERS',
        description: `Cập nhật người dùng ${this.getUserDisplayName(updatedUser)}`,
        resourceId: String(updatedUser.id),
      });
    }

    return result;
  }

  async findUserOrThrow(userId: Identifier) {
    const user = (await this.repository.findById(userId)) as UserRecord | null;
    if (!user) {
      throw ApiError.notFound('Không tìm thấy người dùng');
    }
    return user;
  }

  async deleteUserNotifications(userId: Identifier) {
    const notifications = await notificationsRepository.findAllByUserId(userId);
    await Promise.all(notifications.map((item) => notificationsRepository.delete(item.id)));
    await notificationsRepository.deleteAllSettingsByUserId(userId);
    return notifications.length;
  }

  async deleteUserRewardPenalties(userId: Identifier) {
    const rewardPenaltiesByUser = await rewardPenaltiesRepository.findByUserId(userId);
    const rewardPenaltiesByCreator = await rewardPenaltiesRepository.findByCreatorId(userId);
    const rewardPenaltyMap = new Map<Identifier, AnyRecord>();

    for (const item of [...rewardPenaltiesByUser, ...rewardPenaltiesByCreator]) {
      rewardPenaltyMap.set(item.id, item);
    }

    await Promise.all([...rewardPenaltyMap.values()].map((item) => rewardPenaltiesRepository.delete(item.id)));
  }

  async deleteUserSwapRequests(userId: Identifier) {
    const swapByRequester = await dutySwapRequestsRepository.findMany({ requesterId: userId });
    const swapByTarget = await dutySwapRequestsRepository.findMany({ targetUserId: userId });
    const swapByApprover = await dutySwapRequestsRepository.findMany({ approvedBy: userId });
    const swapMap = new Map<Identifier, AnyRecord>();

    for (const item of [...swapByRequester, ...swapByTarget, ...swapByApprover]) {
      swapMap.set(item.id, item);
    }

    await Promise.all([...swapMap.values()].map((item) => dutySwapRequestsRepository.delete(item.id)));
  }

  async removeUserFromDutySlots(userId: Identifier) {
    const dutySlots = await dutySlotsRepository.findAll();
    const slotUpdates: Promise<unknown>[] = [];

    for (const slot of dutySlots) {
      const assignedUserIds = getAssignedUserIds(slot);
      const filtered = assignedUserIds.filter((id) => Number(id) !== Number(userId));

      if (filtered.length !== assignedUserIds.length) {
        slotUpdates.push(
          dutySlotsRepository.update(slot.id, {
            assignedUserIds: filtered,
            updatedAt: new Date().toISOString(),
          }),
        );
      }
    }

    if (slotUpdates.length > 0) {
      await Promise.all(slotUpdates);
    }
  }

  getSchema() {
    return userSchema;
  }

  async validateUniqueFields(data: AnyRecord, excludeId?: Identifier) {
    const errors: string[] = [];

    if (data.email) {
      const existingEmail = await this.repository.findOne({ email: data.email });
      if (existingEmail && (excludeId === undefined || String(existingEmail.id) !== String(excludeId))) {
        errors.push(`Email '${data.email}' đã tồn tại`);
      }
    }

    if (data.studentId) {
      const existingStudentId = await this.repository.findOne({ studentId: data.studentId });
      if (existingStudentId && (excludeId === undefined || String(existingStudentId.id) !== String(excludeId))) {
        errors.push(`Mã sinh viên '${data.studentId}' đã tồn tại`);
      }
    }

    return errors;
  }

  async validateCreate(data: AnyRecord) {
    const errors = await this.validateUniqueFields(data);
    if (errors.length > 0) {
      return { success: false, message: errors.join('. '), errors };
    }
    return { success: true };
  }

  async validateUpdate(id: Identifier, data: AnyRecord) {
    const errors = await this.validateUniqueFields(data, id);
    if (errors.length > 0) {
      return { success: false, message: errors.join('. '), errors };
    }
    return { success: true };
  }

  async transformImportData(data: AnyRecord) {
    const transformed = await super.transformImportData(data);

    if (transformed.password) {
      transformed.password = await hashPassword(transformed.password);
    }

    if (!transformed.avatar && transformed.name) {
      transformed.avatar = generateAvatarUrl(transformed.name);
    }

    return transformed;
  }

  async beforeCreate(data: AnyRecord) {
    const transformed = this.transformBySchema(data);

    if (transformed.password) {
      transformed.password = await hashPassword(transformed.password);
    }

    if (transformed.firstName || transformed.lastName) {
      transformed.name = `${transformed.lastName || ''} ${transformed.firstName || ''}`.trim();
    }

    if (!transformed.avatar && transformed.name) {
      transformed.avatar = generateAvatarUrl(transformed.name);
    }

    // Auto-sync roles based on position if roleIds are not provided
    if (!transformed.roleIds || (Array.isArray(transformed.roleIds) && transformed.roleIds.length === 0)) {
      transformed.roleIds = getSuggestedRoles(transformed.position as string, transformed.department as string);
    }

    return {
      ...transformed,
      isActive: transformed.isActive !== undefined ? transformed.isActive : true,
      status: transformed.status || 'active',
    };
  }

  async beforeUpdate(id: Identifier, data: AnyRecord) {
    const payload = { ...data };

    if (payload.newPassword) {
      payload.password = await hashPassword(payload.newPassword);
      delete payload.newPassword;
    } else if (payload.password) {
      payload.password = await hashPassword(payload.password);
    }

    // Optional: Auto-sync roles if position/department changed AND roleIds were not explicitly sent
    if (
      (payload.position || payload.department) &&
      (!payload.roleIds || (Array.isArray(payload.roleIds) && payload.roleIds.length === 0))
    ) {
      const current = (await this.repository.findById(id)) as UserRecord;
      if (current) {
        const pos = (payload.position as string) || current.position;
        const dept = (payload.department as string) || current.department;
        payload.roleIds = getSuggestedRoles(pos, dept);
      }
    }

    if (payload.firstName || payload.lastName) {
      const current = (await this.repository.findById(id)) as UserRecord;
      if (current) {
        const lastName = payload.lastName !== undefined ? payload.lastName : current.lastName;
        const firstName = payload.firstName !== undefined ? payload.firstName : current.firstName;

        // Neu name trong payload hien tai dang bi trong hoac khong co, moi tu dong generate tu ho ten.
        // Dieu nay de tranh viec ghi de username (name) neu nguoi dung da co tinh dat khac.
        if (!payload.name) {
          payload.name = `${lastName || ''} ${firstName || ''}`.trim();
        }
      }
    }

    // Luon whitelist theo schema de field noi bo tu controller khong bi luu nham vao user.
    const transformed = this.transformBySchema(payload);

    return {
      ...transformed,
    };
  }

  async getUserStats() {
    const users = (await this.repository.findAll()) as UserRecord[];
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const stats: UserStats = {
      global: createUserStatItem(),
      byDepartment: {},
    };

    for (const user of users) {
      processUserStats(stats.global, user, weekAgo);

      if (user.department) {
        if (!stats.byDepartment[user.department]) {
          stats.byDepartment[user.department] = createUserStatItem();
        }
        processUserStats(stats.byDepartment[user.department], user, weekAgo);
      }
    }

    return stats;
  }

  async getUserActivity(userId: Identifier) {
    const user = await this.findUserOrThrow(userId);

    return {
      user: sanitizeUser(user),
      joinedAt: user.createdAt,
      lastLogin: user.lastLogin,
    };
  }

  async toggleUserStatus(userId: Identifier, performer?: AnyRecord | Identifier) {
    const user = await this.findUserOrThrow(userId);

    const newIsActive = !user.isActive;
    const updateData: AnyRecord = {
      isActive: newIsActive,
    };

    // Unify status: Alumni <=> Inactive
    if (newIsActive && user.status === 'inactive') {
      updateData.status = 'active';
    } else if (!newIsActive && user.status === 'active') {
      updateData.status = 'inactive';
    }

    const updated = await this.repository.update(userId, updateData);

    await auditLogsService.log({
      userId: this.toAuditUserId(performer, user.id),
      action: updated?.isActive ? 'KÍCH HOẠT NGƯỜI DÙNG' : 'VÔ HIỆU HÓA NGƯỜI DÙNG',
      module: 'USERS',
      description: `${updated?.isActive ? 'Kích hoạt' : 'Vô hiệu hóa'} người dùng ${this.getUserDisplayName(user)}`,
      resourceId: String(user.id),
    });

    return sanitizeUser(updated);
  }

  async promoteUser(
    userId: Identifier,
    role: string,
    reason: string | null | undefined,
    actorId: Identifier,
    actorRole: string,
  ) {
    const allowedRoles = ['customer', 'staff', 'admin'];
    if (!allowedRoles.includes(role)) {
      throw ApiError.badRequest(`Vai trò không hợp lệ. Vai trò cho phép: ${allowedRoles.join(', ')}`);
    }

    const user = await this.findUserOrThrow(userId);
    if (user.expelled) throw ApiError.badRequest('Không thể thăng quyền người dùng đã bị khai trừ');
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Không thể tự thay đổi vai trò của chính mình');

    if (actorRole !== 'admin') {
      if (role === 'admin') {
        throw ApiError.forbidden('Chỉ admin mới có thể gán vai trò admin');
      }
      if (user.role === 'admin') {
        throw ApiError.forbidden('Chỉ admin mới có thể thay đổi vai trò của admin');
      }
    }

    const now = new Date().toISOString();
    const updated = await this.repository.update(userId, {
      role,
      promotedAt: now,
      promotedBy: actorId,
      promotionReason: reason || '',
    });

    await notificationService.notifyUser(user.id, {
      title: 'Cập nhật chức vụ',
      message: `Chức vụ của bạn đã được cập nhật thành '${role}'.`,
      type: 'system',
      category: 'system',
      metadata: {
        role,
        reason: reason || '',
      },
    });

    await auditLogsService.log({
      userId: this.toAuditUserId(actorId),
      action: 'THAY ĐỔI VAI TRÒ NGƯỜI DÙNG',
      module: 'USERS',
      description: `Thay đổi vai trò người dùng ${this.getUserDisplayName(user)} sang ${role}`,
      resourceId: String(user.id),
    });

    return sanitizeUser(updated);
  }

  async expelUser(userId: Identifier, reason: string | null | undefined, actorId: Identifier, actorRole: string) {
    const user = await this.findUserOrThrow(userId);
    if (Number(actorId) === Number(user.id))
      throw ApiError.badRequest('Không thể tự khai trừ tài khoản của chính mình');

    if (actorRole !== 'admin' && user.role === 'admin') {
      throw ApiError.forbidden('Chỉ admin mới có thể khai trừ tài khoản admin');
    }

    if (user.expelled) {
      return sanitizeUser(user);
    }

    const now = new Date().toISOString();
    const updated = await this.repository.update(userId, {
      expelled: true,
      expelledAt: now,
      expelReason: reason || '',
      expelledBy: actorId,
      status: 'dismissed',
      isActive: false,
    });

    await notificationService.notifyUser(user.id, {
      title: 'Thông báo khai trừ',
      message: 'Tài khoản của bạn đã bị khai trừ khỏi tổ chức.',
      type: 'approval',
      category: 'approval',
      metadata: {
        reason: reason || '',
      },
    });

    await auditLogsService.log({
      userId: this.toAuditUserId(actorId),
      action: 'KHAI TRỪ NGƯỜI DÙNG',
      module: 'USERS',
      description: `Khai trừ người dùng ${this.getUserDisplayName(user)}`,
      resourceId: String(user.id),
    });

    return sanitizeUser(updated);
  }

  async permanentDeleteUser(userId: Identifier, actorId: Identifier, actorRole: string) {
    const user = await this.findUserOrThrow(userId);
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Không thể tự xóa tài khoản của chính mình');

    if (actorRole !== 'admin' && user.role === 'admin') {
      throw ApiError.forbidden('Chỉ admin mới có thể xóa tài khoản admin');
    }

    const normalizedUserId = this.normalizeUserId(userId);
    const notificationCount = await this.deleteUserNotifications(normalizedUserId);
    await this.deleteUserRewardPenalties(normalizedUserId);
    await this.deleteUserSwapRequests(normalizedUserId);
    await this.removeUserFromDutySlots(normalizedUserId);

    await this.repository.delete(userId);

    await auditLogsService.log({
      userId: this.toAuditUserId(actorId),
      action: 'XÓA NGƯỜI DÙNG',
      module: 'USERS',
      description: `Xóa vĩnh viễn người dùng ${this.getUserDisplayName(user)}`,
      resourceId: String(user.id),
    });

    return { user: 1, notifications: notificationCount };
  }

  async getPotentialAlumni() {
    const generations = await db.findMany('generations', { isActive: false });
    const inactiveGenIds = generations.map((g: any) => g.id);

    if (inactiveGenIds.length === 0) return [];

    const users = await db.findMany('users', {
      generationId: { $in: inactiveGenIds },
      status: 'active',
    });

    return users;
  }

  async syncAlumniStatus(userIds?: Identifier[], actorId?: Identifier) {
    let count = 0;

    if (userIds && Array.isArray(userIds)) {
      // Sync only specific users
      for (const id of userIds) {
        await this.repository.update(id, {
          status: 'inactive',
          isActive: false,
        });
        count++;
      }
    } else {
      // Original logic: sync everyone in inactive generations
      const generations = await db.findMany('generations', {});
      const activeGenIds = new Set(generations.filter((g: any) => g.isActive).map((g: any) => g.id));

      const users = await this.repository.findAll();
      for (const user of users) {
        const isCurrentlyActive = user.status === 'active';
        const shouldBeActive = user.generationId && activeGenIds.has(user.generationId);

        if (isCurrentlyActive && !shouldBeActive) {
          await this.repository.update(user.id, {
            status: 'inactive',
            isActive: false,
          });
          count++;
        }
      }
    }

    if (count > 0) {
      await auditLogsService.log({
        userId: this.toAuditUserId(actorId),
        action: 'ĐỒNG BỘ CỰU THÀNH VIÊN',
        module: 'USERS',
        description: `Cập nhật ${count} thành viên sang trạng thái cựu thành viên`,
      });
    }

    return count;
  }
}

export default new UserService();
