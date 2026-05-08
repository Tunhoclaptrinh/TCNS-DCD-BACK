import jwt from 'jsonwebtoken';
import passwordResetService from '@modules/auth/services/password-reset.service';

import usersRepository from '@modules/users/repositories/users.repository';
import ApiError from '@utils/api-error';
import { comparePassword, generateRefreshToken, generateToken, hashPassword } from '@utils/auth.utils';
import { sanitizeUser } from '@utils/user.utils';
import type { AnyRecord } from '@app-types/common';

import userAccessService from '@modules/users/services/user-access.service';

class AuthService {
  constructor(private readonly userRepository = usersRepository) {}

  normalizeEmail(email: unknown) {
    return String(email || '')
      .toLowerCase()
      .trim();
  }

  async buildAuthResponse(user: AnyRecord, token?: string, refreshToken?: string) {
    return {
      user: sanitizeUser(user),
      permissions: await userAccessService.computePermissions(user),
      ...(token ? { token } : {}),
      ...(refreshToken ? { refreshToken } : {}),
    };
  }

  // async register(payload: AnyRecord) {
  //   const { email, password, name, phone, address } = payload;
  //   const normalizedEmail = this.normalizeEmail(email);
  //   const fullName = String(name || '').trim();

  //   const missingFields = [
  //     !normalizedEmail ? { field: 'email', message: 'email is required' } : null,
  //     !password ? { field: 'password', message: 'password is required' } : null,
  //     !fullName ? { field: 'name', message: 'name is required' } : null,
  //   ].filter(Boolean);

  //   if (missingFields.length > 0) {
  //     throw ApiError.badRequest('Validation failed', missingFields);
  //   }

  //   const existingUser = await this.userRepository.findByEmail(normalizedEmail);
  //   if (existingUser) {
  //     throw ApiError.badRequest('Email already registered');
  //   }

  //   const nameParts = fullName.split(/\s+/);
  //   const firstName = payload.firstName || nameParts.pop() || fullName;
  //   const lastName = payload.lastName || nameParts.join(' ') || firstName;

  //   let generation: AnyRecord | null | undefined;
  //   if (payload.generationId !== undefined && payload.generationId !== null && payload.generationId !== '') {
  //     const generationId = Number(payload.generationId);
  //     if (!Number.isInteger(generationId) || generationId <= 0) {
  //       throw ApiError.badRequest('generationId must be a number');
  //     }

  //     generation = await generationsRepository.findById(generationId);
  //     if (!generation) throw ApiError.badRequest('generationId không tồn tại');
  //   } else {
  //     generation =
  //       (await generationsRepository.findOne({ isCurrent: true })) ||
  //       (await generationsRepository.findOne({ isActive: true })) ||
  //       (await generationsRepository.findAll())[0];
  //   }

  //   if (!generation) {
  //     throw ApiError.badRequest('Không tìm thấy khóa để đăng ký tài khoản');
  //   }

  //   const hashedPassword = await hashPassword(password);
  //   const now = new Date().toISOString();
  //   const user = await this.userRepository.create({
  //     email: normalizedEmail,
  //     password: hashedPassword,
  //     name: fullName,
  //     firstName,
  //     lastName,
  //     generationId: generation.id,
  //     phone,
  //     address: address || '',
  //     avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random`,
  //     role: 'customer',
  //     isActive: true,
  //     createdAt: now,
  //     updatedAt: now,
  //   });

  //   return await this.buildAuthResponse(user);
  // }

  async login(payload: AnyRecord) {
    const normalizedEmail = this.normalizeEmail(payload.email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.unauthorized('Account is inactive');

    // ⚠️ WARNING: Password verification is DISABLED. Re-enable before production!
    // const isMatch = await comparePassword(payload.password, user.password);
    // if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

    const loginTime = new Date().toISOString();
    await this.userRepository.updateLastLogin(user.id, loginTime);

    const updatedUser = await this.userRepository.findById(user.id);
    const token = generateToken(updatedUser.id, updatedUser.lastLogin || loginTime);
    const refreshToken = generateRefreshToken(updatedUser.id, updatedUser.lastLogin || loginTime);

    return this.buildAuthResponse(updatedUser, token, refreshToken);
  }

  async getMe(user: AnyRecord) {
    return {
      ...sanitizeUser(user),
      permissions: await userAccessService.computePermissions(user),
    };
  }

  logout() {
    return { message: 'Logout successful' };
  }

  async changePassword(user: AnyRecord, payload: AnyRecord) {
    const { currentPassword, newPassword } = payload;

    if (!currentPassword || !newPassword) {
      throw ApiError.badRequest('Current password and new password are required');
    }

    if (newPassword.length < 6) {
      throw ApiError.badRequest('New password must be at least 6 characters');
    }

    if (currentPassword === newPassword) {
      throw ApiError.badRequest('New password must be different from current password');
    }

    const isMatch = await comparePassword(currentPassword, user.password);
    if (!isMatch) throw ApiError.badRequest('Current password is incorrect');

    const hashedPassword = await hashPassword(newPassword);
    const now = new Date().toISOString();
    await this.userRepository.update(user.id, {
      password: hashedPassword,
      updatedAt: now,
      lastLogin: now,
    });

    return { message: 'Password changed successfully' };
  }

  async refreshToken(payload: AnyRecord, authHeader?: string) {
    let refreshToken = payload?.refreshToken || payload?.token;

    // Nếu không có trong body, thử lấy từ Header Authorization
    if (!refreshToken && authHeader?.startsWith('Bearer ')) {
      refreshToken = authHeader.split(' ')[1];
    }

    if (!refreshToken) {
      throw ApiError.badRequest('Refresh token is required');
    }

    let decoded: AnyRecord;
    try {
      const refreshSecret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      decoded = jwt.verify(refreshToken, refreshSecret as string) as AnyRecord;
    } catch {
      throw ApiError.unauthorized('Invalid refresh token');
    }

    const user = await this.userRepository.findById(decoded.id);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('User not found or inactive');
    }

    if (decoded.loginTime && user.lastLogin) {
      const isTokenOutdated = new Date(decoded.loginTime).getTime() < new Date(user.lastLogin).getTime();
      if (isTokenOutdated) {
        throw ApiError.unauthorized('Token has been invalidated. Please login again.');
      }
    }

    return {
      success: true,
      token: generateToken(user.id, user.lastLogin || null),
      refreshToken: generateRefreshToken(user.id, user.lastLogin || null),
    };
  }

  async forgotPassword(payload: AnyRecord) {
    return passwordResetService.forgotPassword(payload);
  }

  async resetPassword(payload: AnyRecord) {
    return passwordResetService.resetPassword(payload);
  }
}

export default new AuthService();
