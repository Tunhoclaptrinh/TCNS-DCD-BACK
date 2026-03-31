import BaseService from '@shared/common/base-service';
import usersRepository from '@modules/users/repositories/users.repository';
import notificationsRepository from '@modules/notifications/repositories/notifications.repository';
import rewardPenaltiesRepository from '@modules/reward-penalties/repositories/reward-penalties.repository';
import dutySlotsRepository from '@modules/duty/repositories/duty-slots.repository';
import dutySwapRequestsRepository from '@modules/duty/repositories/duty-swap-requests.repository';
import { sanitizeUser, hashPassword } from '@utils/helpers';
import ApiError from '@utils/api-error';
import userSchema from '@modules/users/schemas/user.schema';
import notificationService from '@modules/notifications/services/notification.service';
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
  recentSignups: number;
  byRole: Record<string, number>;
  byPosition: Record<string, number>;
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
    recentSignups: 0,
    byRole: {},
    byPosition: {},
  };
}

function processUserStats(item: UserStatItem, user: UserRecord, weekAgo: Date) {
  item.total++;
  if (user.status === 'active') item.active++;
  else if (user.status === 'inactive') item.inactive++;
  else if (user.status === 'dismissed') item.dismissed++;

  if (user.position === 'tvb') item.ctv++;
  else if (user.position === 'tv') item.official++;
  else if (user.position === 'ctc') item.management++;

  if (new Date(user.createdAt) >= weekAgo) item.recentSignups++;

  if (user.role) {
    item.byRole[user.role] = (item.byRole[user.role] || 0) + 1;
  }

  if (user.position) {
    item.byPosition[user.position] = (item.byPosition[user.position] || 0) + 1;
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

  async findUserOrThrow(userId: Identifier) {
    const user = (await this.repository.findById(userId)) as UserRecord | null;
    if (!user) {
      throw ApiError.notFound('User not found');
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

    return {
      ...transformed,
      isActive: transformed.isActive !== undefined ? transformed.isActive : true,
      status: transformed.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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

    if (payload.firstName || payload.lastName) {
      const current = (await this.repository.findById(id)) as UserRecord;
      const lastName = payload.lastName !== undefined ? payload.lastName : current.lastName;
      const firstName = payload.firstName !== undefined ? payload.firstName : current.firstName;
      payload.name = `${lastName || ''} ${firstName || ''}`.trim();
    }

    // Luon whitelist theo schema de field noi bo tu controller khong bi luu nham vao user.
    const transformed = this.transformBySchema(payload);

    return {
      ...transformed,
      updatedAt: new Date().toISOString(),
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

  async toggleUserStatus(userId: Identifier) {
    const user = await this.findUserOrThrow(userId);

    const updated = await this.repository.update(userId, {
      isActive: !user.isActive,
      updatedAt: new Date().toISOString(),
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
      throw ApiError.badRequest(`Invalid role. Allowed roles: ${allowedRoles.join(', ')}`);
    }

    const user = await this.findUserOrThrow(userId);
    if (user.expelled) throw ApiError.badRequest('Cannot promote expelled user');
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Cannot change your own role');

    if (actorRole !== 'admin') {
      if (role === 'admin') {
        throw ApiError.forbidden('Only admin can assign admin role');
      }
      if (user.role === 'admin') {
        throw ApiError.forbidden('Only admin can change admin role');
      }
    }

    const now = new Date().toISOString();
    const updated = await this.repository.update(userId, {
      role,
      promotedAt: now,
      promotedBy: actorId,
      promotionReason: reason || '',
      updatedAt: now,
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

    return sanitizeUser(updated);
  }

  async expelUser(userId: Identifier, reason: string | null | undefined, actorId: Identifier, actorRole: string) {
    const user = await this.findUserOrThrow(userId);
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Cannot expel your own account');

    if (actorRole !== 'admin' && user.role === 'admin') {
      throw ApiError.forbidden('Only admin can expel admin account');
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
      isActive: false,
      updatedAt: now,
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

    return sanitizeUser(updated);
  }

  async permanentDeleteUser(userId: Identifier, actorId: Identifier, actorRole: string) {
    const user = await this.findUserOrThrow(userId);
    if (Number(actorId) === Number(user.id)) throw ApiError.badRequest('Cannot delete your own account');

    if (actorRole !== 'admin' && user.role === 'admin') {
      throw ApiError.forbidden('Only admin can delete admin account');
    }

    const normalizedUserId = this.normalizeUserId(userId);
    const notificationCount = await this.deleteUserNotifications(normalizedUserId);
    await this.deleteUserRewardPenalties(normalizedUserId);
    await this.deleteUserSwapRequests(normalizedUserId);
    await this.removeUserFromDutySlots(normalizedUserId);

    await this.repository.delete(userId);

    return { user: 1, notifications: notificationCount };
  }
}

export default new UserService();
