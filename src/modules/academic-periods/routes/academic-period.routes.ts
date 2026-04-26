import express from 'express';
import academicPeriodController from '@modules/academic-periods/controllers/academic-period.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', academicPeriodController.getAll);
router.get('/current', academicPeriodController.getCurrent);
router.get('/:id', academicPeriodController.getById);

router.post('/', requirePermission('system:manage'), academicPeriodController.create);
router.put('/:id', requirePermission('system:manage'), academicPeriodController.update);
router.delete('/:id', requirePermission('system:manage'), academicPeriodController.delete);

export default router;
