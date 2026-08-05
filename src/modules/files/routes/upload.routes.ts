import express from 'express';
import uploadController from '@modules/files/controllers/upload.controller';
import { requireAuth, requireRole } from '@middleware/auth.middleware';

const router = express.Router();

// Protected routes (any authenticated user)
router.use(requireAuth);

// Upload Avatar
router.post('/avatar', uploadController.getUploadMiddleware('avatar'), uploadController.uploadAvatar);

// Upload General File
router.post('/general', uploadController.getUploadMiddleware('general'), uploadController.uploadGeneralFile);

// Delete file (any authenticated user can delete their own uploaded file)
router.delete('/file', uploadController.deleteFile);

// Management (Admin only)
router.use(requireRole('admin'));

router.get('/file/info', uploadController.getFileInfo);
router.get('/stats', uploadController.getStorageStats);
router.post('/cleanup', uploadController.cleanupOldFiles);

export default router;
