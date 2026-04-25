import express from 'express';
import permissionController from '@modules/permissions/controllers/permission.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// Apply auth middleware to all routes
router.use(requireAuth);

router.get('/', requirePermission('system:manage_roles'), permissionController.getAll);
router.get('/:id', requirePermission('system:manage_roles'), permissionController.getById);
router.post('/', requirePermission('system:manage_roles'), permissionController.create);
router.put('/:id', requirePermission('system:manage_roles'), permissionController.update);
router.delete('/:id', requirePermission('system:manage_roles'), permissionController.delete);

export default router;
