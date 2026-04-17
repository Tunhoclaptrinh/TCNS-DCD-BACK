import express from 'express';
import userController from '@modules/users/controllers/user.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validateSchema } from '@middleware/schema-validation.middleware';
import importExportController from '@shared/import-export/controllers/import-export.controller';

const router = express.Router();

// === USER PROFILE ROUTES (Must be before :id routes) ===
router.put('/profile', requireAuth, userController.getAvatarUploadMiddleware(), userController.updateProfile);

// === BASE & SEARCH ROUTES ===
router.get('/search', requireAuth, userController.search);
router.get('/count', requireAuth, requirePermission('users:list'), userController.count);
router.post('/bulk', requireAuth, requirePermission('users:update'), userController.bulk);
router.post('/validate', requireAuth, userController.validate);

// === ADMIN ROUTES ===
// Quản lý user, stats, status
router.post('/', requireAuth, requirePermission('users:create'), validateSchema('user'), userController.create);

router.put(
  '/:id',
  requireAuth,
  requirePermission('users:update'),
  userController.getAvatarUploadMiddleware(),
  userController.update,
);

router.delete('/:id', requireAuth, requirePermission('users:delete'), userController.delete);

router.get('/', requireAuth, requirePermission('users:list'), userController.getAll);

router.get('/stats/summary', requireAuth, requirePermission('users:view_stats'), userController.getUserStats);

router.patch('/:id/status', requireAuth, requirePermission('users:manage_status'), userController.toggleUserStatus);
router.patch('/:id/promote', requireAuth, requirePermission('users:update'), userController.promoteUser);
router.patch('/:id/expel', requireAuth, requirePermission('users:expel'), userController.expelUser);

router.delete('/:id/permanent', requireAuth, requirePermission('users:delete'), userController.permanentDeleteUser);

// === IMPORT/EXPORT (ADMIN ONLY) ===
router.get('/template', requireAuth, requirePermission('users:import_export'), (req, res, next) => {
  (req.params as Record<string, string>).entity = 'users';
  importExportController.downloadTemplate(req, res, next);
});

router.post(
  '/validate-import',
  requireAuth,
  requirePermission('users:import_export'),
  importExportController.getUploadMiddleware(),
  (req, res, next) => {
    (req.params as Record<string, string>).entity = 'users';
    importExportController.validateData(req, res, next);
  },
);

router.post(
  '/import',
  requireAuth,
  requirePermission('users:import_export'),
  importExportController.getUploadMiddleware(),
  (req, res, next) => {
    (req.params as Record<string, string>).entity = 'users';
    importExportController.importData(req, res, next);
  },
);

router.get('/export', requireAuth, requirePermission('users:import_export'), (req, res, next) => {
  (req.params as Record<string, string>).entity = 'users';
  importExportController.exportData(req, res, next);
});

// User xem profile chính mình hoặc Admin xem profile người khác
router.get('/:id/activity', requireAuth, userController.getUserActivity);
router.get('/:id', requireAuth, userController.getById);

export default router;
