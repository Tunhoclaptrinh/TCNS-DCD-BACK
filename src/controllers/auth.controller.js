import { validationResult } from 'express-validator';
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

    const user = await db.findOne('users', { email });
    if (!user) throw ApiError.unauthorized('Invalid email or password');
    if (!user.isActive) throw ApiError.unauthorized('Account is inactive');

    const isMatch = await comparePassword(password, user.password);
    if (!isMatch) throw ApiError.unauthorized('Invalid email or password');

    await db.update('users', user.id, { lastLogin: new Date().toISOString() });
    const updatedUser = await db.findById('users', user.id);
    const token = generateToken(updatedUser.id);

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
    await db.update('users', req.user.id, { password: hashedPassword });

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    next(error);
  }
};

export default { register, login, getMe, logout, changePassword };
