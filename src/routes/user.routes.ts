import express from 'express';
import userController from '@controllers/user.controller';
import { protect } from '@middleware/auth.middleware';
import { checkPermission } from '@middleware/rbac.middleware';
import { getSchemaDoc, validateSchema } from '@middleware/validation.middleware';
import importExportController from '@controllers/importExport.controller';

const router = express.Router();

// === USER PROFILE ROUTES (Must be before :id routes) ===
router.put('/profile', protect, userController.getAvatarUploadMiddleware(), userController.updateProfile);

// === BASE & SEARCH ROUTES ===
router.get('/search', protect, userController.search);
router.get('/count', protect, checkPermission('users:list'), userController.count);
router.post('/bulk', protect, checkPermission('users:update'), userController.bulk);
router.post('/validate', protect, userController.validate);

// === ADMIN ROUTES ===
// Quản lý user, stats, status
router.post('/', protect, checkPermission('users:create'), validateSchema('user'), userController.create);

router.put(
  '/:id',
  protect,
  checkPermission('users:update'),
  userController.getAvatarUploadMiddleware(),
  userController.update,
);

router.delete('/:id', protect, checkPermission('users:delete'), userController.delete);

router.get('/', protect, checkPermission('users:list'), userController.getAll);

router.get('/stats/summary', protect, checkPermission('users:view_stats'), userController.getUserStats);

router.patch('/:id/status', protect, checkPermission('users:manage_status'), userController.toggleUserStatus);
router.patch('/:id/promote', protect, checkPermission('users:manage_rank'), userController.promoteUser);
router.patch('/:id/expel', protect, checkPermission('users:expel'), userController.expelUser);

router.delete('/:id/permanent', protect, checkPermission('users:delete'), userController.permanentDeleteUser);

// === IMPORT/EXPORT (ADMIN ONLY) ===
router.get('/template', protect, checkPermission('users:import_export'), (req, res, next) => {
  (req.params as Record<string, string>).entity = 'users';
  importExportController.downloadTemplate(req, res, next);
});

router.post(
  '/import',
  protect,
  checkPermission('users:import_export'),
  importExportController.getUploadMiddleware(),
  (req, res, next) => {
    (req.params as Record<string, string>).entity = 'users';
    importExportController.importData(req, res, next);
  },
);

router.get('/export', protect, checkPermission('users:import_export'), (req, res, next) => {
  (req.params as Record<string, string>).entity = 'users';
  importExportController.exportData(req, res, next);
});

// === PUBLIC/USER ROUTES ===
router.get('/schema', (req, res, next) => {
  (req.params as Record<string, string>).entity = 'user';
  getSchemaDoc(req, res);
});

// User xem profile chính mình hoặc Admin xem profile người khác
router.get('/:id/activity', protect, userController.getUserActivity);
router.get('/:id', protect, userController.getById);

export default router;
