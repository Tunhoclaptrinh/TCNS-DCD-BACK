const { validationResult } = require('express-validator');
const db = require('../config/database');
const { generateToken, hashPassword, comparePassword, sanitizeUser } = require('../utils/helpers');

exports.register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { email, password, name } = req.body;
    const existingUser = await db.findOne('users', { email });

    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    const hashedPassword = await hashPassword(password);
    const user = await db.create('users', {
      email,
      password: hashedPassword,
      name,
      role: 'user',
      isActive: true
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: { user: sanitizeUser(user) }
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db.findOne('users', { email });

    if (!user || !(await comparePassword(password, user.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user.id);
    res.json({
      success: true,
      data: { user: sanitizeUser(user), token }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  res.json({ success: true, data: sanitizeUser(req.user) });
};
