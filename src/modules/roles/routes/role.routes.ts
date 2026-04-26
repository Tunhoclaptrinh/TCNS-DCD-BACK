import express from 'express';
import roleController from '@modules/roles/controllers/role.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';
import { validateSchema } from '@middleware/schema-validation.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', requirePermission('system:manage_roles'), roleController.getAll);
router.get('/:id', requirePermission('system:manage_roles'), roleController.getById);

router.post('/', requirePermission('system:manage_roles'), validateSchema('roles'), roleController.create);

router.put('/:id', requirePermission('system:manage_roles'), roleController.update);
router.patch('/:id', requirePermission('system:manage_roles'), roleController.patch);

router.delete('/:id', requirePermission('system:manage_roles'), roleController.delete);

export default router;
