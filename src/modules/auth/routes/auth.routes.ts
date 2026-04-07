import express from 'express';
import authController from '@modules/auth/controllers/auth.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { mapNewPassword, requireResetEmail } from '@middleware/normalize-auth-payload.middleware';
import { validateFields, validateSchema } from '@middleware/schema-validation.middleware';

const router = express.Router();

// Register - validate tất cả schema fields
router.post('/register', validateSchema('user'), authController.register);

// Login - custom validate email + password
router.post('/login', validateFields('user', ['email', 'password']), authController.login);

// Forgot password
router.post('/forgot-password', requireResetEmail, validateFields('user', ['email']), authController.forgotPassword);

// Reset password
router.post(
  '/reset-password',
  requireResetEmail,
  mapNewPassword,
  validateFields('user', ['email', 'password']),
  authController.resetPassword,
);

// Get me
router.get('/me', requireAuth, authController.getMe);

// Logout
router.post('/logout', requireAuth, authController.logout);

// Change password - custom validate
router.put(
  '/change-password',
  requireAuth,
  mapNewPassword,
  validateFields('user', ['password']),
  authController.changePassword,
);

// Refresh Token
router.post('/refresh', authController.refresh);

export default router;
