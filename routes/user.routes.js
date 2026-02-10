const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const { protect } = require('../middleware/auth.middleware');
const { checkPermission } = require('../middleware/rbac.middleware');
const { getSchemaDoc, validateSchema } = require('../middleware/validation.middleware');
const importExportController = require('../controllers/importExport.controller');

// === USER PROFILE ROUTES (Must be before :id routes) ===
router.put('/profile',
  protect,
  userController.updateProfile
);

// === ADMIN ROUTES ===
// Quản lý user, stats, status
router.post('/',
  protect,
  checkPermission('users', 'create'),
  validateSchema('user'),
  userController.create
);

router.put('/:id',
  protect,
  checkPermission('users', 'update'),
  userController.update
);

router.delete('/:id',
  protect,
  checkPermission('users', 'delete'),
  userController.delete
);

router.get('/',
  protect,
  checkPermission('users', 'list'),
  userController.getAll
);

router.get('/stats/summary',
  protect,
  checkPermission('users', 'view_stats'), // Quyền system hoặc users
  userController.getUserStats
);

router.patch('/:id/status',
  protect,
  checkPermission('users', 'manage_status'),
  userController.toggleUserStatus
);

router.delete('/:id/permanent',
  protect,
  checkPermission('users', 'delete'),
  userController.permanentDeleteUser
);

// === IMPORT/EXPORT (ADMIN ONLY) ===
router.get('/template', protect, checkPermission('users', 'import_export'), (req, res, next) => {
  req.params.entity = 'users';
  importExportController.downloadTemplate(req, res, next);
});

router.post('/import', protect, checkPermission('users', 'import_export'), importExportController.getUploadMiddleware(), (req, res, next) => {
  req.params.entity = 'users';
  importExportController.importData(req, res, next);
});

router.get('/export', protect, checkPermission('users', 'import_export'), (req, res, next) => {
  req.params.entity = 'users';
  importExportController.exportData(req, res, next);
});

// === PUBLIC/USER ROUTES ===
router.get('/schema', (req, res, next) => {
  req.params.entity = 'user';
  getSchemaDoc(req, res);
});

// User xem profile chính mình hoặc Admin xem profile người khác
router.get('/:id/activity', protect, userController.getUserActivity);
router.get('/:id', protect, userController.getById);



module.exports = router;