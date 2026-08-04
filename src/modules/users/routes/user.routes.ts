import express from 'express';
import userController from '@modules/users/controllers/user.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import importExportController from '@shared/import-export/controllers/import-export.controller';

const router = express.Router();

// === USER PROFILE ROUTES (Must be before :id routes) ===
router.put('/profile', requireAuth, userController.getAvatarUploadMiddleware(), userController.updateProfile);
router.get('/me/stats', requireAuth, userController.getMeStats);

// === BASE & SEARCH ROUTES ===
// public-search: bất kỳ user đã auth (để tìm kiếm thành viên trong form picker)
router.get('/public-search', requireAuth, userController.search);
// search nâng cao: cần quyền xem danh sách (users:list → alias users:list:all | users:list:dept)
router.get('/search', requireAuth, requirePermission('users:list'), userController.search);
router.get('/count', requireAuth, requirePermission('users:list'), userController.count);
router.post('/bulk', requireAuth, requirePermission('users:update'), userController.bulk);
router.post('/validate', requireAuth, userController.validate);

// === ADMIN ROUTES ===
// Tạo mới thành viên
router.post('/', requireAuth, requirePermission('users:create'), userController.create);

// Cập nhật thông tin thành viên
// (users:update → alias users:update:profile | users:update:org)
router.put(
  '/:id',
  requireAuth,
  requirePermission('users:update'),
  userController.getAvatarUploadMiddleware(),
  userController.update,
);

// Cập nhật một phần (quyền tùy chỉnh / vai trò)
router.patch('/:id', requireAuth, requirePermission('system:permissions:edit'), userController.patch);

// Xóa tạm thời (soft-delete)
router.delete('/:id', requireAuth, requirePermission('users:delete'), userController.delete);

// Danh sách thành viên
router.get('/', requireAuth, requirePermission('users:list'), userController.getAll);

// Thống kê
router.get('/stats/summary', requireAuth, requirePermission('users:view_stats'), userController.getUserStats);

// Toggle trạng thái (Khai trừ / Kích hoạt lại)
// (users:manage_status → alias users:update:org | users:expel)
router.patch('/:id/status', requireAuth, requirePermission('users:manage_status'), userController.toggleUserStatus);

// Nâng hạng
router.patch('/:id/promote', requireAuth, requirePermission('users:promote'), userController.promoteUser);

// Khai trừ
router.patch('/:id/expel', requireAuth, requirePermission('users:expel'), userController.expelUser);

// Công cụ chốt cựu thành viên (cần update:org)
router.get('/potential-alumni', requireAuth, requirePermission('users:update:org'), userController.getPotentialAlumni);
router.post('/sync-alumni', requireAuth, requirePermission('users:update:org'), userController.syncAlumniStatus);

// Xóa vĩnh viễn
router.delete('/:id/permanent', requireAuth, requirePermission('users:delete'), userController.permanentDeleteUser);

// === IMPORT/EXPORT ===
// Template: cần quyền import
router.get('/template', requireAuth, requirePermission('users:import'), (req, res, next) => {
  (req.params as Record<string, string>).entity = 'users';
  importExportController.downloadTemplate(req, res, next);
});

// Validate import
router.post(
  '/validate-import',
  requireAuth,
  requirePermission('users:import'),
  importExportController.getUploadMiddleware(),
  (req, res, next) => {
    (req.params as Record<string, string>).entity = 'users';
    importExportController.validateData(req, res, next);
  },
);

// Import thực sự
router.post(
  '/import',
  requireAuth,
  requirePermission('users:import'),
  importExportController.getUploadMiddleware(),
  (req, res, next) => {
    (req.params as Record<string, string>).entity = 'users';
    importExportController.importData(req, res, next);
  },
);

// Export
router.get('/export', requireAuth, requirePermission('users:export'), (req, res, next) => {
  (req.params as Record<string, string>).entity = 'users';
  importExportController.exportData(req, res, next);
});

// User xem profile chính mình hoặc Admin xem profile người khác
router.get('/:id/activity', requireAuth, userController.getUserActivity);
router.get('/:id', requireAuth, userController.getById);

export default router;
