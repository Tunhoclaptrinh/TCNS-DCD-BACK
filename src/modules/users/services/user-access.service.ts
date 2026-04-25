import ApiError from '@utils/api-error';
import type { Identifier } from '@app-types/common';
import db from '@database';

const CAN_READ_OTHERS_ROLES = new Set(['admin', 'staff', 'researcher']);

const POSITION_LEVELS: Record<string, number> = {
  ctc: 0, // Cộng tác viên
  tv: 1, // Thành viên
  tvb: 2, // Thành viên ban
  pb: 3, // Phó ban
  tb: 4, // Trưởng ban
  dt: 5, // Đội trưởng
};

class UserAccessService {
  normalizeTargetId(targetId: Identifier) {
    return parseInt(String(targetId), 10);
  }

  /**
   * Aggregates permissions from multiple roles and applies individual overrides.
   * Logic: (RolePermissions + ExtraPermissions) - DeniedPermissions
   */
  async computePermissions(user: any) {
    if (!user) return [];

    // 1. Get permissions from all roles
    const roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
    const roles = await db.findMany('roles', { id_in: roleIds });

    const permissionSet = new Set<string>();
    roles.forEach((role: any) => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach((p: string) => permissionSet.add(p));
      }
    });

    // 2. Add extra permissions
    const extra = user.customPermissions?.extra || [];
    extra.forEach((p: string) => permissionSet.add(p));

    // 3. Remove denied permissions
    const denied = user.customPermissions?.denied || [];
    denied.forEach((p: string) => permissionSet.delete(p));

    // Special case for legacy 'admin' role if needed
    if (user.role === 'admin') {
      // In a real system, you might want to auto-grant all permissions to admins
      // But for now, we rely on the seeded 'admin' role in roleIds.
    }

    return Array.from(permissionSet);
  }

  canReadOtherProfiles(user) {
    return CAN_READ_OTHERS_ROLES.has(String(user?.role || ''));
  }

  assertCanReadProfile(actor, targetId: Identifier) {
    const normalizedTargetId = this.normalizeTargetId(targetId);

    if (actor.id !== normalizedTargetId && !this.canReadOtherProfiles(actor)) {
      throw ApiError.forbidden('Not authorized to view this profile');
    }
  }

  assertNotSelfAction(actor, targetId: Identifier, message = 'Cannot perform this action on your own account') {
    if (actor.id === this.normalizeTargetId(targetId)) {
      throw ApiError.badRequest(message);
    }
  }

  assertAuthority(actor: any, target: any, newPosition?: string) {
    if (actor.role === 'admin') return;

    const actorLevel = POSITION_LEVELS[actor.position] || 0;
    const targetLevel = POSITION_LEVELS[target.position] || 0;
    const newLevel = newPosition ? POSITION_LEVELS[newPosition] || 0 : -1;

    if (actorLevel <= targetLevel && actor.id !== target.id) {
      throw ApiError.forbidden('Không có quyền quản lý thành viên cùng cấp hoặc cấp cao hơn');
    }

    if (newLevel >= 0 && newLevel >= actorLevel) {
      throw ApiError.forbidden('Không thể nâng hạng thành viên lên bằng hoặc cao hơn cấp bậc của chính mình');
    }
  }
}

export default new UserAccessService();
