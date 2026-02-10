const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateSchema, validateFields } = require('../middleware/validation.middleware');



// Register - validate tất cả schema fields
router.post('/register',
  validateSchema('user'),
  authController.register
);

// Login - custom validate email + password
router.post('/login',
  validateFields('user', ['email', 'password']),
  authController.login
);

// Get me
router.get('/me', protect, authController.getMe);

// Logout
router.post('/logout', protect, authController.logout);

// Change password - custom validate
router.put('/change-password',
  protect,
  (req, res, next) => {
    if (req.body.newPassword) {
      req.body.password = req.body.newPassword;
    }
    next();
  },
  validateFields('user', ['password']),
  authController.changePassword
);

// Refresh Token (Simplified for demo)
router.post('/refresh', (req, res) => {
    // For demo, just return success true
    res.json({ success: true, token: 'demo_refreshed_token' });
});

module.exports = router;