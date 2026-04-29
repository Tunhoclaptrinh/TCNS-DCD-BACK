import BaseRepository from '@shared/repositories/base.repository';
import type { Identifier } from '@app-types/common';

class OtpCodesRepository extends BaseRepository {
  constructor() {
    super('otp_codes');
  }

  async findActiveResetOtp(userId: Identifier, email: string, nowIso: string) {
    return await this.findOne({
      userId,
      email,
      purpose: 'reset_password',
      usedAt: null,
      expiresAt_gt: nowIso,
    });
  }
}

export default new OtpCodesRepository();
