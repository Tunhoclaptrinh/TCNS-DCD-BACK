import crypto from 'crypto';
import db from '@config/database';
import otpDeliveryService from '@services/auth/otp-delivery.service';
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
  channel: 'sms' | 'email';
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

  normalizePhone(phone: unknown) {
    const raw = String(phone || '').trim();
    if (!raw) return '';

    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.startsWith('84')) {
      return `0${digits.slice(2)}`;
    }

    return digits;
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

  async findUserByIdentifier({ email, phone }: { email?: string; phone?: string }) {
    if (email) {
      const byEmail = await db.findOne('users', { email });
      if (byEmail) return byEmail;
    }

    if (phone) {
      const normalizedPhone = this.normalizePhone(phone);
      const candidates = [String(phone).trim(), normalizedPhone].filter(Boolean);

      for (const phoneCandidate of candidates) {
        const byPhone = await db.findOne('users', { phone: phoneCandidate });
        if (byPhone) return byPhone;
      }
    }

    return null;
  }

  resolveOtpTarget(user: AnyRecord) {
    const userPhone = String(user?.phone || '').trim();
    const userEmail = this.normalizeEmail(user?.email);

    if (userPhone) {
      return { channel: 'sms' as const, target: userPhone };
    }

    if (userEmail) {
      return { channel: 'email' as const, target: userEmail };
    }

    return { channel: null, target: null };
  }

  async forgotPassword(payload: AnyRecord) {
    const normalizedEmail = this.normalizeEmail(payload.email);
    const rawPhone = String(payload.phone || '').trim();
    const normalizedPhone = this.normalizePhone(rawPhone);

    if (!normalizedEmail && !normalizedPhone) {
      throw ApiError.badRequest('Email hoặc số điện thoại là bắt buộc');
    }

    const genericMessage = 'Nếu tài khoản tồn tại, mã OTP đã được gửi';
    const user = await this.findUserByIdentifier({ email: normalizedEmail, phone: rawPhone || normalizedPhone });
    if (!user || !user.isActive) {
      return { message: genericMessage };
    }

    const { channel, target } = this.resolveOtpTarget(user);
    if (!channel || !target) {
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
      channel,
      target,
      sentAtTs: Date.now(),
      expiresAtTs: new Date(expiresAt).getTime(),
    });

    if (channel === 'sms') {
      await otpDeliveryService.sendSmsOtp({
        to: target,
        otp,
        expiresMinutes: OTP_EXPIRE_MINUTES,
      });
    } else {
      await otpDeliveryService.sendEmailOtp({
        to: target,
        otp,
        expiresMinutes: OTP_EXPIRE_MINUTES,
      });
    }

    if ((process.env.NODE_ENV || 'development') !== 'production') {
      return {
        message: genericMessage,
        channel,
        target: this.maskTarget(target),
        otpPreview: otp,
        otpExpiresAt: expiresAt,
      };
    }

    return { message: genericMessage };
  }

  async resetPassword(payload: AnyRecord) {
    const normalizedEmail = this.normalizeEmail(payload.email);
    const rawPhone = String(payload.phone || '').trim();
    const normalizedPhone = this.normalizePhone(rawPhone);
    const otp = String(payload.otp || payload.token || '').trim();
    const newPassword = payload.newPassword;

    if (!normalizedEmail && !normalizedPhone) {
      throw ApiError.badRequest('Email hoặc số điện thoại là bắt buộc');
    }

    if (!otp || !newPassword) {
      throw ApiError.badRequest('OTP và mật khẩu mới là bắt buộc');
    }

    const user = await this.findUserByIdentifier({ email: normalizedEmail, phone: rawPhone || normalizedPhone });
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

    await db.update('users', user.id, {
      password: hashedPassword,
      updatedAt: now,
      lastLogin: now,
    });

    return { message: 'Đặt lại mật khẩu thành công' };
  }
}

export default new PasswordResetService();
