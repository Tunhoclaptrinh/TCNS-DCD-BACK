import express from 'express';
import auditLogsController from '@modules/audit-logs/controllers/audit-logs.controller';
import { requireAuth } from '@middleware/auth.middleware';

const router = express.Router();

// Tat ca endpoint audit log deu yeu cau dang nhap
router.use(requireAuth);

router.get('/', auditLogsController.getLogs);

export default router;
