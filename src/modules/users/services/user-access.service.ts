import ApiError from '@utils/api-error';
import type { Identifier } from '@app-types/common';

const CAN_READ_OTHERS_ROLES = new Set(['admin', 'staff', 'researcher']);

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
}

export default new UserAccessService();
