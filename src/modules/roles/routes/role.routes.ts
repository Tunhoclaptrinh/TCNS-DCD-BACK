import express from 'express';
import roleController from '@modules/roles/controllers/role.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

// GET: chỉ cần quyền xem roles (ns_specialist và cao hơn có quyền này)
router.get('/', requirePermission('system:roles:view'), roleController.getAll);
router.get('/:id', requirePermission('system:roles:view'), roleController.getById);

// WRITE: tạo/sửa/xóa cần quyền cao hơn
router.post('/', requirePermission('system:roles:create'), roleController.create);

router.put('/:id', requirePermission('system:roles:update'), roleController.update);
router.patch('/:id', requirePermission('system:roles:update'), roleController.patch);

router.delete('/:id', requirePermission('system:roles:delete'), roleController.delete);

export default router;
