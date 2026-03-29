import express from 'express';
import fileController from '@modules/files/controllers/file.controller';
import { protect } from '@middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.get('/', fileController.getFiles);
router.get('/:id', fileController.getFileById);

export default router;
