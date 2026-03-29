import express from 'express';
import reportController from '@modules/reports/controllers/report.controller';
import { protect } from '@middleware/auth.middleware';
import { checkPermission } from '@middleware/rbac.middleware';

const router = express.Router();

router.use(protect);

router.get('/overview', checkPermission('reports:view'), reportController.getOverview);
router.get('/export', checkPermission('reports:export'), reportController.exportOverview);

export default router;
