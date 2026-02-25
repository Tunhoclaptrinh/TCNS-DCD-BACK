import express from 'express';
import authController from '@controllers/auth.controller';
import { protect } from '@middleware/auth.middleware';
import { validateSchema, validateFields } from '@middleware/validation.middleware';

const router = express.Router();

// Register - validate tất cả schema fields
router.post('/register', validateSchema('user'), authController.register);

// Login - custom validate email + password
router.post('/login', validateFields('user', ['email', 'password']), authController.login);

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

// Refresh Token (Simplified for demo)
router.post('/refresh', (req, res) => {
  res.json({ success: true, token: 'demo_refreshed_token' });
});

export default router;
