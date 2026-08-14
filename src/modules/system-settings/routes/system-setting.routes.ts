import express from 'express';
import controller from '../controllers/system-setting.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.get('/', requireAuth, requirePermission('system:manage'), controller.getAll);
router.get('/key/:key', requireAuth, controller.getByKey);
router.post('/bulk', requireAuth, requirePermission('system:manage'), controller.bulkUpdateSettings);

export default router;
