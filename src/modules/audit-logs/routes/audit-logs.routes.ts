import express from 'express';
import auditLogsController from '@modules/audit-logs/controllers/audit-logs.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// Tat ca endpoint audit log deu yeu cau dang nhap
router.use(requireAuth);

router.get('/', requirePermission('system:manage'), auditLogsController.getLogs);

export default router;
