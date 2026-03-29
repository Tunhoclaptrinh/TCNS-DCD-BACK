import jwt from 'jsonwebtoken';
import passwordResetService from '@modules/auth/services/password-reset.service';
import usersRepository from '@modules/users/repositories/users.repository';
import { getRolePermissions } from '@shared/security/permission-policy';
import ApiError from '@utils/api-error';
import { comparePassword, generateRefreshToken, generateToken, hashPassword, sanitizeUser } from '@utils/helpers';
import type { AnyRecord } from '@app-types/common';

class AuthService {
  constructor(private readonly userRepository = usersRepository) {}

  normalizeEmail(email: unknown) {
    return String(email || '')
      .toLowerCase()
      .trim();
  }

  buildAuthResponse(user: AnyRecord, token?: string, refreshToken?: string) {
    return {
      user: sanitizeUser(user),
      permissions: getRolePermissions(user.role),
      ...(token ? { token } : {}),
      ...(refreshToken ? { refreshToken } : {}),
    };
  }

  async register(payload: AnyRecord) {
    const { email, password, name, phone, address } = payload;
    const normalizedEmail = this.normalizeEmail(email);

    const existingUser = await this.userRepository.findByEmail(normalizedEmail);
    if (existingUser) {
      throw ApiError.badRequest('Email already registered');
    }

    const hashedPassword = await hashPassword(password);
    const now = new Date().toISOString();
    const user = await this.userRepository.create({
      email: normalizedEmail,
      password: hashedPassword,
      name,
      phone,
      address: address || '',
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
      role: 'customer',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return this.buildAuthResponse(user);
  }

  async login(payload: AnyRecord) {
    const normalizedEmail = this.normalizeEmail(payload.email);
    const user = await this.userRepository.findByEmail(normalizedEmail);

    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.unauthorized('Account is inactive');

    const isMatch = await comparePassword(payload.password, user.password);
    if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

    const loginTime = new Date().toISOString();
    await this.userRepository.updateLastLogin(user.id, loginTime);

    const updatedUser = await this.userRepository.findById(user.id);
    const token = generateToken(updatedUser.id, updatedUser.lastLogin || loginTime);
    const refreshToken = generateRefreshToken(updatedUser.id, updatedUser.lastLogin || loginTime);

    return this.buildAuthResponse(updatedUser, token, refreshToken);
  }

  getMe(user: AnyRecord) {
    return {
      ...sanitizeUser(user),
      permissions: getRolePermissions(user.role),
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

  async refreshToken(payload: AnyRecord) {
    const refreshToken = payload?.refreshToken || payload?.token;
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
