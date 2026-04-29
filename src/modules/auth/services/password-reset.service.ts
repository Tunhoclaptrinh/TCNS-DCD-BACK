import crypto from 'crypto';
import otpCodesRepository from '@modules/auth/repositories/otp-codes.repository';
import otpDeliveryService from '@modules/auth/services/otp-delivery.service';
import usersRepository from '@modules/users/repositories/users.repository';
import ApiError from '@utils/api-error';
import { hashPassword } from '@utils/helpers';
import type { AnyRecord } from '@app-types/common';

const OTP_EXPIRE_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRE_MINUTES || 10));
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));
const OTP_RESEND_COOLDOWN_SECONDS = Math.max(0, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60));
const OTP_LENGTH = 6;
const OTP_PURPOSE = 'reset_password';

class PasswordResetService {
  async cleanupExpiredOtps() {
    await otpCodesRepository.deleteMany({
      purpose: OTP_PURPOSE,
      expiresAt_lt: new Date().toISOString(),
    });
  }

  normalizeEmail(email: unknown) {
    return String(email || '')
      .toLowerCase()
      .trim();
  }

  hashOtp(token: string) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
  }

  generateOtpCode() {
    const max = 10 ** OTP_LENGTH;
    return String(Math.floor(Math.random() * max)).padStart(OTP_LENGTH, '0');
  }

  maskTarget(target: string) {
    const text = String(target || '');
    if (!text) return '';

    if (text.includes('@')) {
      const [local, domain] = text.split('@');
      if (!local || !domain) return text;

      const left = local.slice(0, 2);
      const right = local.length > 2 ? '*'.repeat(Math.max(2, local.length - 2)) : '**';
      return `${left}${right}@${domain}`;
    }

    if (text.length <= 4) return '*'.repeat(text.length);
    return `${'*'.repeat(text.length - 4)}${text.slice(-4)}`;
  }

  async getActiveOtp(userId: number, email: string) {
    return await otpCodesRepository.findActiveResetOtp(userId, email, new Date().toISOString());
  }

  async findUserByEmail(email?: string) {
    if (!email) return null;
    return await usersRepository.findByEmail(email);
  }

  resolveOtpTarget(user: AnyRecord) {
    const userEmail = this.normalizeEmail(user?.email);

    if (userEmail) {
      return userEmail;
    }

    return null;
  }

  async forgotPassword(payload: AnyRecord) {
    await this.cleanupExpiredOtps();

    const normalizedEmail = this.normalizeEmail(payload.email);

    if (!normalizedEmail) {
      throw ApiError.badRequest('Email là bắt buộc');
    }

    const genericMessage = 'Nếu tài khoản tồn tại, mã OTP đã được gửi';
    const user = await this.findUserByEmail(normalizedEmail);
    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    const target = this.resolveOtpTarget(user);
    if (!target) {
      return { message: genericMessage };
    }

    const activeOtp = await this.getActiveOtp(user.id, target);
    const nowTs = Date.now();
    const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
    const nextResendAtTs = activeOtp?.nextResendAt ? new Date(activeOtp.nextResendAt).getTime() : 0;

    if (cooldownMs > 0 && nextResendAtTs > nowTs) {
      const retryAfterSeconds = Math.ceil((nextResendAtTs - nowTs) / 1000);
      throw new ApiError(429, `Vui lòng chờ ${retryAfterSeconds} giây trước khi yêu cầu OTP mới`);
    }

    const otp = this.generateOtpCode();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_EXPIRE_MINUTES * 60 * 1000).toISOString();
    const nextResendAt = new Date(now.getTime() + cooldownMs).toISOString();

    if (activeOtp) {
      await otpCodesRepository.delete(activeOtp.id);
    }

    await otpCodesRepository.create({
      userId: user.id,
      email: target,
      purpose: OTP_PURPOSE,
      otpHash: this.hashOtp(otp),
      attemptCount: 0,
      maxAttempts: OTP_MAX_VERIFY_ATTEMPTS,
      sentAt: now.toISOString(),
      nextResendAt,
      expiresAt,
      usedAt: null,
    });

    await otpDeliveryService.sendEmailOtp({
      to: target,
      otp,
      expiresMinutes: OTP_EXPIRE_MINUTES,
    });

    if ((process.env.NODE_ENV || 'development') !== 'production') {
      return {
        message: genericMessage,
        target: this.maskTarget(target),
        otpPreview: otp,
        otpExpiresAt: expiresAt,
      };
    }

    return { message: genericMessage };
  }

  async resetPassword(payload: AnyRecord) {
    await this.cleanupExpiredOtps();

    const normalizedEmail = this.normalizeEmail(payload.email);
    const otp = String(payload.otp || payload.token || '').trim();
    const newPassword = payload.newPassword || payload.password;

    if (!normalizedEmail) {
      throw ApiError.badRequest('Email là bắt buộc');
    }

    if (!otp || !newPassword) {
      throw ApiError.badRequest('OTP và mật khẩu mới là bắt buộc');
    }

    const user = await this.findUserByEmail(normalizedEmail);
    const activeOtp = user ? await this.getActiveOtp(user.id, normalizedEmail) : null;

    if (!user || !activeOtp) {
      throw ApiError.badRequest('OTP không hợp lệ hoặc đã hết hạn');
    }

    const now = new Date().toISOString();
    const attempts = Number(activeOtp.attemptCount || 0);
    const maxAttempts = Number(activeOtp.maxAttempts || OTP_MAX_VERIFY_ATTEMPTS);

    if (attempts >= maxAttempts) {
      await otpCodesRepository.delete(activeOtp.id);
      throw ApiError.badRequest('Bạn đã nhập sai OTP quá số lần cho phép, hãy yêu cầu mã mới');
    }

    if (new Date(activeOtp.expiresAt).getTime() < Date.now()) {
      await otpCodesRepository.delete(activeOtp.id);
      throw ApiError.badRequest('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (this.hashOtp(otp) !== activeOtp.otpHash) {
      const nextAttempts = attempts + 1;

      if (nextAttempts >= maxAttempts) {
        await otpCodesRepository.delete(activeOtp.id);
      } else {
        await otpCodesRepository.update(activeOtp.id, {
          attemptCount: nextAttempts,
          updatedAt: now,
        });
      }

      throw ApiError.badRequest('OTP không chính xác');
    }

    const hashedPassword = await hashPassword(newPassword);

    await usersRepository.update(user.id, {
      password: hashedPassword,
      updatedAt: now,
      lastLogin: now,
    });

    await otpCodesRepository.update(activeOtp.id, {
      usedAt: now,
      updatedAt: now,
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }
}

export default new PasswordResetService();
