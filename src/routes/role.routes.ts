import express from 'express';
import roleController from '@controllers/role.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// All role routes require authentication and admin permission
router.use(requireAuth);
router.use(requirePermission('system:manage_roles'));

router.get('/', roleController.getAll);
router.post('/', roleController.create);
router.get('/:id', roleController.getById);
router.put('/:id', roleController.update);
router.delete('/:id', roleController.delete);
router.post('/bulk', roleController.bulk);

export default router;
