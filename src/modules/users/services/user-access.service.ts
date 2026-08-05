import ApiError from '@utils/api-error';
import type { Identifier } from '@app-types/common';
import db from '@database/mongo-database.adapter';

const CAN_READ_OTHERS_ROLES = new Set([
  'admin',
  'ns_leader',
  'ns_sub_leader',
  'ns_specialist',
  'tc_leader',
  'tt_leader',
  'other_leader',
]);

const POSITION_LEVELS: Record<string, number> = {
  ctv: 0, // Cộng tác viên
  tv: 1, // Thành viên thường
  tvb: 2, // Thành viên ban
  pb: 3, // Phó ban
  tb: 4, // Trưởng ban
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

    // 1. Get permissions dynamically from roles defined in DB
    let roleIds = Array.isArray(user.roleIds) ? user.roleIds : [];
    let roles: any[] = [];
    if (roleIds.length > 0) {
      roles = await db.findMany('roles', { id_in: roleIds });
    }

    if (roles.length === 0) {
      const keysToSearch = [user.role, user.position].filter(Boolean);
      if (keysToSearch.length > 0) {
        roles = await db.findMany('roles', { key_in: keysToSearch });
      }
    }

    const permissionSet = new Set<string>();
    roles.forEach((role: any) => {
      if (Array.isArray(role.permissions)) {
        role.permissions.forEach((p: string) => {
          permissionSet.add(p);
        });
      }
    });

    // Ensure all active members/CTVs have basic view_stats and duty permissions
    if (user.position || ['member', 'ctv'].includes(user.role)) {
      permissionSet.add('users:view_stats');
      permissionSet.add('users:list:dept');
      permissionSet.add('duty:view');
    }

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

  canReadOtherProfiles(user: any) {
    const perms = user.permissions || [];
    return perms.includes('*') || perms.includes('users:list:all') || perms.includes('users:read:all');
  }

  canReadDeptProfiles(user: any) {
    const perms = user.permissions || [];
    return perms.includes('users:list:dept');
  }

  assertCanReadProfile(actor: any, target: any) {
    if (actor.id === this.normalizeTargetId(target.id)) return;

    if (actor.position === 'ctv' && target.position !== 'ctv') {
      throw ApiError.forbidden('Cộng tác viên chỉ có quyền xem thông tin của Cộng tác viên');
    }

    const canReadAll = this.canReadOtherProfiles(actor);
    if (canReadAll) return;

    const canReadDept = this.canReadDeptProfiles(actor);
    if (canReadDept && actor.department === target.department) return;

    throw ApiError.forbidden('Bạn không có quyền xem hồ sơ này');
  }

  assertNotSelfAction(
    actor: any,
    targetId: Identifier,
    message = 'Không thể thực hiện thao tác này trên chính tài khoản của bạn',
  ) {
    if (actor.id === this.normalizeTargetId(targetId)) {
      throw ApiError.badRequest(message);
    }
  }

  assertAuthority(actor: any, target: any, newPosition?: string) {
    const actorPermissions = actor.permissions || [];
    const isAdmin = actorPermissions.includes('*');
    if (isAdmin) return;

    const actorLevel = POSITION_LEVELS[actor.position] || 0;
    const targetLevel = POSITION_LEVELS[target.position] || 0;
    const newLevel = newPosition ? POSITION_LEVELS[newPosition] || 0 : -1;

    // Enforce departmental boundary for TB/PB
    const isDeptLeader = ['pb', 'tb'].includes(actor.position);
    if (isDeptLeader && actor.department !== target.department) {
      throw ApiError.forbidden(`Bạn chỉ có quyền quản lý thành viên thuộc ban ${actor.department}`);
    }

    if (actorLevel <= targetLevel && actor.id !== target.id) {
      throw ApiError.forbidden('Không có quyền quản lý thành viên cùng cấp hoặc cấp cao hơn');
    }

    if (newLevel >= 0 && newLevel >= actorLevel) {
      throw ApiError.forbidden('Không thể nâng hạng thành viên lên bằng hoặc cao hơn cấp bậc của chính mình');
    }
  }
}

export default new UserAccessService();
