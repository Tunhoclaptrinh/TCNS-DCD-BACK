import express from 'express';
import fileController from '@modules/files/controllers/file.controller';
import { requireAuth } from '@middleware/auth.middleware';

const router = express.Router();

router.use(requireAuth);

router.get('/', fileController.getFiles);
router.get('/:id', fileController.getFileById);
router.post('/url', fileController.createUrlOnly);

export default router;
