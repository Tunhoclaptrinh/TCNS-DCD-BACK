import express from 'express';
import fileController from '@controllers/file/file.controller';
import { protect } from '@middleware/auth.middleware';

const router = express.Router();

router.use(protect);

router.get('/', fileController.getFiles);
router.get('/:id', fileController.getFileById);

export default router;
