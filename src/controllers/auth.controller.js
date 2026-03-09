import { validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';
import db from '@config/database';
import { generateToken, hashPassword, comparePassword, sanitizeUser } from '@utils/helpers';
import { getRolePermissions } from '@middleware/rbac.middleware';
import ApiError from '@utils/api-error';

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw ApiError.badRequest('Validation failed', errors.array());
  }
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
    const normalizedEmail = String(email || '')
      .toLowerCase()
      .trim();

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

    res.json({
      user: sanitizeUser(updatedUser),
      permissions: getRolePermissions(updatedUser.role),
      token,
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
      decoded = jwt.verify(refreshToken, process.env.JWT_SECRET, { ignoreExpiration: true });
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
    res.json({ success: true, token });
  } catch (error) {
    next(error);
  }
};

export default { register, login, getMe, logout, changePassword, refresh };
