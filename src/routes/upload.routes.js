const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { protect, authorize } = require('../middleware/auth.middleware');

// Public routes (if any)
// router.get('/public', uploadController.getPublicUploads);

// Protected routes
router.use(protect);

// Upload Avatar
router.post('/avatar', uploadController.getUploadMiddleware('avatar'), uploadController.uploadAvatar);

// Upload General File
router.post('/general', uploadController.getUploadMiddleware('general'), uploadController.uploadGeneralFile);

// Management (Admin only)
router.use(authorize('admin'));

router.delete('/file', uploadController.deleteFile);
router.get('/file/info', uploadController.getFileInfo);
router.get('/stats', uploadController.getStorageStats);
router.post('/cleanup', uploadController.cleanupOldFiles);

module.exports = router;
