import express from 'express';
import uploadController from '@controllers/upload/upload.controller';
import { protect, authorize } from '@middleware/auth.middleware';

const router = express.Router();

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

export default router;
