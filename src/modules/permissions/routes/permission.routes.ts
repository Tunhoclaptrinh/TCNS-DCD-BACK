import express from 'express';
import permissionController from '@modules/permissions/controllers/permission.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

// GET: cần quyền xem ma trận phân quyền
router.get('/', requirePermission('system:permissions:view'), permissionController.getAll);
router.get('/:id', requirePermission('system:permissions:view'), permissionController.getById);

// WRITE: chỉnh sửa phân quyền
router.post('/', requirePermission('system:permissions:edit'), permissionController.create);
router.put('/:id', requirePermission('system:permissions:edit'), permissionController.update);
router.delete('/:id', requirePermission('system:permissions:edit'), permissionController.delete);

export default router;
