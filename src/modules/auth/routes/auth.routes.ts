import express from 'express';
import authController from '@modules/auth/controllers/auth.controller';
import { protect } from '@middleware/auth.middleware';
import { copyNewPasswordField, requirePasswordResetTarget } from '@middleware/normalize-auth-payload.middleware';
import { validateSchema, validateFields } from '@middleware/schema-validation.middleware';

const router = express.Router();

// Register - validate tất cả schema fields
router.post('/register', validateSchema('user'), authController.register);

// Login - custom validate email + password
router.post('/login', validateFields('user', ['email', 'password']), authController.login);

// Forgot password
router.post('/forgot-password', requirePasswordResetTarget, authController.forgotPassword);

// Reset password
router.post(
  '/reset-password',
  copyNewPasswordField,
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
  copyNewPasswordField,
  validateFields('user', ['password']),
  authController.changePassword,
);

// Refresh Token
router.post('/refresh', authController.refresh);

export default router;
