import express from 'express';
import generationController from '@controllers/generation/generation.controller';
import { requireAuth, requireRole } from '@middleware/auth.middleware';

const router = express.Router();

// All generation routes require admin or staff privileges
router.use(requireAuth);
router.use(requireRole('admin', 'staff'));

router.get('/', generationController.getAll);
router.get('/:id', generationController.getById);
router.post('/', generationController.create);
router.put('/:id', generationController.update);
router.delete('/:id', generationController.delete);
router.patch('/:id/set-current', generationController.setCurrent);

export default router;
