import crypto from 'crypto';
import otpDeliveryService from '@modules/auth/services/otp-delivery.service';
import usersRepository from '@modules/users/repositories/users.repository';
import ApiError from '@utils/api-error';
import { hashPassword } from '@utils/helpers';
import type { AnyRecord } from '@app-types/common';

const OTP_EXPIRE_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRE_MINUTES || 10));
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));
const OTP_RESEND_COOLDOWN_SECONDS = Math.max(0, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60));
const OTP_LENGTH = 6;

type OtpState = {
  otpHash: string;
  attempts: number;
  target: string;
  sentAtTs: number;
  expiresAtTs: number;
};

class PasswordResetService {
  otpStateStore: Map<string, OtpState>;

  constructor() {
    // Tạm giữ OTP trong memory để tách riêng vòng đời quên mật khẩu khỏi auth chính.
    this.otpStateStore = new Map();
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

  getOtpState(userId: string | number) {
    const key = String(userId);
    const state = this.otpStateStore.get(key);
    if (!state) return null;

    if (Date.now() > state.expiresAtTs) {
      this.otpStateStore.delete(key);
      return null;
    }

    return state;
  }

  setOtpState(userId: string | number, state: OtpState) {
    this.otpStateStore.set(String(userId), state);
  }

  clearOtpState(userId: string | number) {
    this.otpStateStore.delete(String(userId));
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

    const currentOtpState = this.getOtpState(user.id);
    const sentAtTs = currentOtpState?.sentAtTs || 0;
    const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
    if (cooldownMs > 0 && sentAtTs && Date.now() - sentAtTs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - (Date.now() - sentAtTs)) / 1000);
      throw new ApiError(429, `Vui lòng chờ ${retryAfterSeconds} giây trước khi yêu cầu OTP mới`);
    }

    const otp = this.generateOtpCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000).toISOString();

    this.setOtpState(user.id, {
      otpHash: this.hashOtp(otp),
      attempts: 0,
      target,
      sentAtTs: Date.now(),
      expiresAtTs: new Date(expiresAt).getTime(),
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
    const normalizedEmail = this.normalizeEmail(payload.email);
    const otp = String(payload.otp || payload.token || '').trim();
    const newPassword = payload.newPassword;

    if (!normalizedEmail) {
      throw ApiError.badRequest('Email là bắt buộc');
    }

    if (!otp || !newPassword) {
      throw ApiError.badRequest('OTP và mật khẩu mới là bắt buộc');
    }

    const user = await this.findUserByEmail(normalizedEmail);
    const otpState = user ? this.getOtpState(user.id) : null;
    const attempts = Number(otpState?.attempts || 0);

    if (!user || !otpState) {
      throw ApiError.badRequest('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      this.clearOtpState(user.id);
      throw ApiError.badRequest('Bạn đã nhập sai OTP quá số lần cho phép, hãy yêu cầu mã mới');
    }

    if (otpState.expiresAtTs < Date.now()) {
      this.clearOtpState(user.id);
      throw ApiError.badRequest('OTP không hợp lệ hoặc đã hết hạn');
    }

    if (this.hashOtp(otp) !== otpState.otpHash) {
      const nextAttempts = attempts + 1;

      if (nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        this.clearOtpState(user.id);
      } else {
        this.setOtpState(user.id, {
          ...otpState,
          attempts: nextAttempts,
        });
      }

      throw ApiError.badRequest('OTP không chính xác');
    }

    const hashedPassword = await hashPassword(newPassword);
    const now = new Date().toISOString();
    this.clearOtpState(user.id);

    await usersRepository.update(user.id, {
      password: hashedPassword,
      updatedAt: now,
      lastLogin: now,
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }
}

export default new PasswordResetService();
