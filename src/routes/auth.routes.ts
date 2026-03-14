import express from 'express';
import authController from '@controllers/auth/auth.controller';
import { protect } from '@middleware/auth.middleware';
import { mapNewPasswordField, validateForgotPasswordTarget } from '@middleware/auth-request.middleware';
import { validateSchema, validateFields } from '@middleware/validation.middleware';

const router = express.Router();

// Register - validate tất cả schema fields
router.post('/register', validateSchema('user'), authController.register);

// Login - custom validate email + password
router.post('/login', validateFields('user', ['email', 'password']), authController.login);

// Forgot password
router.post('/forgot-password', validateForgotPasswordTarget, authController.forgotPassword);

// Reset password
router.post('/reset-password', mapNewPasswordField, validateFields('user', ['password']), authController.resetPassword);

// Get me
router.get('/me', protect, authController.getMe);

// Logout
router.post('/logout', protect, authController.logout);

// Change password - custom validate
router.put(
  '/change-password',
  protect,
  mapNewPasswordField,
  validateFields('user', ['password']),
  authController.changePassword,
);

// Refresh Token
router.post('/refresh', authController.refresh);

export default router;
