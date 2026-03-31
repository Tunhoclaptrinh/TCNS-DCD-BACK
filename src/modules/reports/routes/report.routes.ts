import express from 'express';
import reportController from '@modules/reports/controllers/report.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/overview', requirePermission('reports:view'), reportController.getOverview);
router.get('/export', requirePermission('reports:export'), reportController.exportOverview);

export default router;
