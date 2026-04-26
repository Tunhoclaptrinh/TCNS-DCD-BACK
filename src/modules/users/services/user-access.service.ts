import ApiError from '@utils/api-error';
import type { Identifier } from '@app-types/common';
import db from '@database';

const CAN_READ_OTHERS_ROLES = new Set(['admin', 'staff', 'researcher']);

const POSITION_LEVELS: Record<string, number> = {
  ctv: 0, // Cộng tác viên
  tv: 1, // Thành viên thường
  tvb: 2, // Thành viên ban
  pb: 3, // Phó ban
  tb: 4, // Trưởng ban
  ctc: 5, // Chủ tịch
  dt: 6, // Đội trưởng
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
    let roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];

    // Backward compatibility: If no roleIds but has legacy role string
    if (roleIds.length === 0 && user.role) {
      const legacyRole = await db.findOne('roles', { key: user.role });
      if (legacyRole) {
        roleIds = [legacyRole.id];
      }
    }

    const roles = await db.findMany('roles', { id_in: roleIds });

    const permissionSet = new Set<string>();
    roles.forEach((role: any) => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach((p: string) => {
          if (p === '*') {
            // If it's a super-admin role, we might want to expand all permissions
            // or just keep it as '*' and handle it in rbac middleware.
            permissionSet.add('*');
          } else {
            permissionSet.add(p);
          }
        });
      }
    });

    // 2. Add extra permissions
    const extra = user.customPermissions?.extra || [];
    extra.forEach((p: string) => permissionSet.add(p));

    // 3. Remove denied permissions
    const denied = user.customPermissions?.denied || [];
    denied.forEach((p: string) => permissionSet.delete(p));

    // Super-admin logic: if has '*', add all available permissions
    if (permissionSet.has('*')) {
      const allPermissions = await db.findAll('permissions');
      allPermissions.forEach((p: any) => permissionSet.add(p.key));
    }

    return Array.from(permissionSet);
  }

  canReadOtherProfiles(user) {
    return CAN_READ_OTHERS_ROLES.has(String(user?.role || ''));
  }

  assertCanReadProfile(actor, targetId: Identifier) {
    const normalizedTargetId = this.normalizeTargetId(targetId);

    if (actor.id !== normalizedTargetId && !this.canReadOtherProfiles(actor)) {
      throw ApiError.forbidden('Bạn không có quyền xem hồ sơ này');
    }
  }

  assertNotSelfAction(
    actor,
    targetId: Identifier,
    message = 'Không thể thực hiện thao tác này trên chính tài khoản của bạn',
  ) {
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
