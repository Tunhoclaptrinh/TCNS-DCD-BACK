const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { protect } = require('../middleware/auth.middleware');
const { validateSchema, validateFields } = require('../middleware/validation.middleware');

router.post('/register', validateSchema('users'), authController.register);
router.post('/login', validateFields('users', ['email', 'password']), authController.login);
router.get('/me', protect, authController.getMe);

module.exports = router;
