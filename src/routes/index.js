const express = require('express');
const router = express.Router();

// Auth
router.use('/auth', require('./auth.routes'));
router.use('/users', require('./user.routes'));

router.use('/upload', require('./upload.routes'));
router.use('/notifications', require('./notification.routes'));

module.exports = router;
