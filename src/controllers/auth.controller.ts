import { validationResult } from 'express-validator';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import db from '@config/database';
import { generateToken, generateRefreshToken, hashPassword, comparePassword, sanitizeUser } from '@utils/helpers';
import { getRolePermissions } from '@middleware/rbac.middleware';
import otpDeliveryService from '@services/common/otp-delivery.service';
import ApiError from '@utils/api-error';

const OTP_EXPIRE_MINUTES = Math.max(1, Number(process.env.OTP_EXPIRE_MINUTES || 10));
const OTP_MAX_VERIFY_ATTEMPTS = Math.max(1, Number(process.env.OTP_MAX_VERIFY_ATTEMPTS || 5));
const OTP_RESEND_COOLDOWN_SECONDS = Math.max(0, Number(process.env.OTP_RESEND_COOLDOWN_SECONDS || 60));
const OTP_LENGTH = 6;
const otpStateStore = new Map();

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array());
  }
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function normalizeEmail(email) {
  return String(email || '')
    .toLowerCase()
    .trim();
}

function normalizePhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';

  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('84')) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

function maskTarget(target) {
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

function generateOtpCode() {
  const max = 10 ** OTP_LENGTH;
  return String(Math.floor(Math.random() * max)).padStart(OTP_LENGTH, '0');
}

function getOtpState(userId) {
  const key = String(userId);
  const state = otpStateStore.get(key);
  if (!state) return null;

  if (Date.now() > state.expiresAtTs) {
    otpStateStore.delete(key);
    return null;
  }

  return state;
}

function setOtpState(userId, state) {
  otpStateStore.set(String(userId), state);
}

function clearOtpState(userId) {
  otpStateStore.delete(String(userId));
}

async function findUserByIdentifier({ email, phone }) {
  if (email) {
    const byEmail = await db.findOne('users', { email });
    if (byEmail) return byEmail;
  }

  if (phone) {
    const normalizedPhone = normalizePhone(phone);
    const candidates = [String(phone).trim(), normalizedPhone].filter(Boolean);

    for (const phoneCandidate of candidates) {
      const byPhone = await db.findOne('users', { phone: phoneCandidate });
      if (byPhone) return byPhone;
    }
  }

  return null;
}

function getOtpTarget(user) {
  const userPhone = String(user?.phone || '').trim();
  const userEmail = normalizeEmail(user?.email);

  if (userPhone) {
    return { channel: 'sms', target: userPhone };
  }

  if (userEmail) {
    return { channel: 'email', target: userEmail };
  }

  return { channel: null, target: null };
}

export const register = async (req, res, next) => {
  try {
    checkValidation(req);

    const { email, password, name, phone, address } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await db.findOne('users', { email: normalizedEmail });
    if (existingUser) {
      throw ApiError.badRequest('Email already registered');
    }

    const hashedPassword = await hashPassword(password);

    const user = await db.create('users', {
      email: normalizedEmail,
      password: hashedPassword,
      name,
      phone,
      address: address || '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      role: 'customer',
      isActive: true,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({
      user: sanitizeUser(user),
      permissions: getRolePermissions(user.role),
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req, res, next) => {
  try {
    checkValidation(req);

    const { email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);

    const user = await db.findOne('users', { email: normalizedEmail });
    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.unauthorized('Account is inactive');

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

    const loginTime = new Date().toISOString();
    await db.update('users', user.id, {
      lastLogin: loginTime,
      updatedAt: loginTime,
    });
    const updatedUser = await db.findById('users', user.id);
    const token = generateToken(updatedUser.id, updatedUser.lastLogin || loginTime);
    const refreshToken = generateRefreshToken(updatedUser.id, updatedUser.lastLogin || loginTime);

    res.json({
      user: sanitizeUser(updatedUser),
      permissions: getRolePermissions(updatedUser.role),
      token,
      refreshToken,
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req, res, next) => {
  try {
    res.json({
      ...sanitizeUser(req.user),
      permissions: getRolePermissions(req.user.role),
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.json({ message: 'Logout successful' });
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req, res, next) => {
  try {
    checkValidation(req);

    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('Current password and new password are required');
    }

    if (newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters');
    }

    if (currentPassword === newPassword) {
      throw ApiError.badRequest('New password must be different from current password');
    }

    const isMatch = await comparePassword(currentPassword, req.user.password);
    if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

    const hashedPassword = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await db.update('users', req.user.id, {
      password: hashedPassword,
      updatedAt: now,
      lastLogin: now,
    });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.body?.refreshToken || req.body?.token;
    if (!refreshToken) {
      throw ApiError.badRequest('Refresh token is required');
    }

    let decoded;
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const user = await db.findById('users', decoded.id);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    if (decoded.loginTime && user.lastLogin) {
      const isTokenOutdated = new Date(decoded.loginTime).getTime() < new Date(user.lastLogin).getTime();
      if (isTokenOutdated) {
        throw ApiError.unauthorized('Token has been invalidated. Please login again.');
      }
    }

    const token = generateToken(user.id, user.lastLogin || null);
    const nextRefreshToken = generateRefreshToken(user.id, user.lastLogin || null);
    res.json({ success: true, token, refreshToken: nextRefreshToken });
  } catch (error) {
    next(error);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    checkValidation(req);

    const normalizedEmail = normalizeEmail(req.body.email);
    const rawPhone = String(req.body.phone || '').trim();
    const normalizedPhone = normalizePhone(rawPhone);

    if (!normalizedEmail && !normalizedPhone) {
      throw ApiError.badRequest('Email or phone is required');
    }

    const genericMessage = 'If an account exists, an OTP has been sent';
    const user = await findUserByIdentifier({ email: normalizedEmail, phone: rawPhone || normalizedPhone });
    if (!user || !user.isActive) {
      return res.json({ message: genericMessage });
    }

    const { channel, target } = getOtpTarget(user);
    if (!channel || !target) {
      return res.json({ message: genericMessage });
    }

    const currentOtpState = getOtpState(user.id);
    const sentAtTs = currentOtpState?.sentAtTs || 0;
    const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000;
    if (cooldownMs > 0 && sentAtTs && Date.now() - sentAtTs < cooldownMs) {
      const retryAfterSeconds = Math.ceil((cooldownMs - (Date.now() - sentAtTs)) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${retryAfterSeconds}s before requesting a new OTP`,
      });
    }

    const otp = generateOtpCode();
    const otpHash = hashResetToken(otp);
    const expiresAt = new Date(Date.now() + OTP_EXPIRE_MINUTES * 60 * 1000).toISOString();
    setOtpState(user.id, {
      otpHash,
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
      return res.json({
        message: genericMessage,
        channel,
        target: maskTarget(target),
        otpPreview: otp,
        otpExpiresAt: expiresAt,
      });
    }

    return res.json({ message: genericMessage });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    checkValidation(req);

    const normalizedEmail = normalizeEmail(req.body.email);
    const rawPhone = String(req.body.phone || '').trim();
    const normalizedPhone = normalizePhone(rawPhone);
    const otp = String(req.body.otp || req.body.token || '').trim();
    const newPassword = req.body.newPassword;

    if (!normalizedEmail && !normalizedPhone) {
      throw ApiError.badRequest('Email or phone is required');
    }

    if (!otp || !newPassword) {
      throw ApiError.badRequest('OTP and new password are required');
    }

    const user = await findUserByIdentifier({ email: normalizedEmail, phone: rawPhone || normalizedPhone });
    const otpState = user ? getOtpState(user.id) : null;
    const attempts = Number(otpState?.attempts || 0);

    if (!user || !otpState) {
      throw ApiError.badRequest('Invalid or expired OTP');
    }

    if (attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
      clearOtpState(user.id);
      throw ApiError.badRequest('OTP attempt limit exceeded. Please request a new OTP');
    }

    if (otpState.expiresAtTs < Date.now()) {
      clearOtpState(user.id);
      throw ApiError.badRequest('Invalid or expired OTP');
    }

    const isOtpMatch = hashResetToken(otp) === otpState.otpHash;
    if (!isOtpMatch) {
      const nextAttempts = attempts + 1;
      if (nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS) {
        clearOtpState(user.id);
      } else {
        setOtpState(user.id, {
          ...otpState,
          attempts: nextAttempts,
        });
      }
      throw ApiError.badRequest('Invalid OTP');
    }

    const hashedPassword = await hashPassword(newPassword);
    const now = new Date().toISOString();
    clearOtpState(user.id);

    await db.update('users', user.id, {
      password: hashedPassword,
      updatedAt: now,
      lastLogin: now,
    });

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    next(error);
  }
};

export default { register, login, getMe, logout, changePassword, refresh, forgotPassword, resetPassword };
