import express from 'express';
import authController from '@controllers/auth.controller';
import { protect } from '@middleware/auth.middleware';
import { validateSchema, validateFields } from '@middleware/validation.middleware';

const router = express.Router();

const validateForgotPasswordPayload = (req, res, next) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';

  if (!email && !phone) {
    return res.status(400).json({
      success: false,
      message: 'Email or phone is required',
    });
  }

  next();
};

// Register - validate tất cả schema fields
router.post('/register', validateSchema('user'), authController.register);

// Login - custom validate email + password
router.post('/login', validateFields('user', ['email', 'password']), authController.login);

// Forgot password
router.post('/forgot-password', validateForgotPasswordPayload, authController.forgotPassword);

// Reset password
router.post(
  '/reset-password',
  (req, res, next) => {
    if (req.body.newPassword) {
      req.body.password = req.body.newPassword;
    }
    next();
  },
  validateFields('user', ['password']),
  authController.resetPassword,
);

// Get me
router.get('/me', protect, authController.getMe);

// Logout
router.post('/logout', protect, authController.logout);

// Change password - custom validate
router.put(
  '/change-password',
  protect,
  (req, res, next) => {
    if (req.body.newPassword) {
      req.body.password = req.body.newPassword;
    }
    next();
  },
  validateFields('user', ['password']),
  authController.changePassword,
);

// Refresh Token
router.post('/refresh', authController.refresh);

export default router;
