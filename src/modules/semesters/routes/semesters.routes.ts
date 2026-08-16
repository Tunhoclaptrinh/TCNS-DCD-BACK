import { Router } from 'express';
import semestersController from '../controllers/semesters.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', semestersController.getAll);
router.get('/:id', semestersController.getById);
router.post('/', requirePermission('settings:manage'), semestersController.create);
router.put('/:id', requirePermission('settings:manage'), semestersController.update);
router.delete('/:id', requirePermission('settings:manage'), semestersController.delete);
router.patch('/:id/set-current', requirePermission('settings:manage'), semestersController.setCurrent);

export default router;
