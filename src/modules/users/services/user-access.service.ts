import ApiError from '@utils/api-error';
import type { Identifier } from '@app-types/common';

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

  canReadOtherProfiles(user) {
    return CAN_READ_OTHERS_ROLES.has(String(user?.role || ''));
  }

  // Gom rule truy cập vào một chỗ để controller không lặp lại business rule.
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

  /**
   * Check if actor has authority to manage target based on role and position hierarchy.
   * Only DT or Admin can promote/update others to high ranks.
   */
  assertAuthority(actor: any, target: any, newPosition?: string) {
    if (actor.role === 'admin') return;

    const actorLevel = POSITION_LEVELS[actor.position] || 0;
    const targetLevel = POSITION_LEVELS[target.position] || 0;
    const newLevel = newPosition ? POSITION_LEVELS[newPosition] || 0 : -1;

    // 1. Staff cannot manage someone with equal or higher rank
    if (actorLevel <= targetLevel && actor.id !== target.id) {
      throw ApiError.forbidden('Không có quyền quản lý thành viên cùng cấp hoặc cấp cao hơn');
    }

    // 2. Staff cannot promote someone to a rank higher than or equal to their own
    if (newLevel >= 0 && newLevel >= actorLevel) {
      throw ApiError.forbidden('Không thể nâng hạng thành viên lên bằng hoặc cao hơn cấp bậc của chính mình');
    }
  }
}

export default new UserAccessService();
