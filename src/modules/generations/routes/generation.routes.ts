import express from 'express';
import generationController from '@modules/generations/controllers/generation.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// Tất cả các route yêu cầu phân quyền quản trị/staff tương tự bản stable
router.use(requireAuth);

router.get('/', requirePermission('generations:manage'), generationController.getAll);
router.get('/:id', requirePermission('generations:manage'), generationController.getById);

router.post('/', requirePermission('generations:manage'), generationController.create);

router.put('/:id', requirePermission('generations:manage'), generationController.update);

router.delete('/:id', requirePermission('generations:manage'), generationController.delete);

router.patch('/:id/set-current', requirePermission('generations:manage'), generationController.setCurrent);

export default router;
