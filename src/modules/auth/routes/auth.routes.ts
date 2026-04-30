import express from 'express';
import authController from '@modules/auth/controllers/auth.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { mapNewPassword } from '@middleware/normalize-auth-payload.middleware';

const router = express.Router();

// Public register is disabled.
// router.post('/register', authController.register);

// Login - custom validate email (removed password validation as requested)
router.post('/login', authController.login);

// Forgot password
router.post('/forgot-password', authController.forgotPassword);

// Reset password
router.post('/reset-password', mapNewPassword, authController.resetPassword);

// Get me
router.get('/me', requireAuth, authController.getMe);

// Logout
router.post('/logout', requireAuth, authController.logout);

// Change password - custom validate
router.put('/change-password', requireAuth, mapNewPassword, authController.changePassword);

// Refresh Token
router.post('/refresh', authController.refresh);

export default router;
