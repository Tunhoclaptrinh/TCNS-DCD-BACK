import express from 'express';
import generationController from '@modules/generations/controllers/generation.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// Tất cả các route yêu cầu đăng nhập
router.use(requireAuth);

// GET: tất cả tài khoản đăng nhập đều được lấy danh sách khóa để lọc nhân sự
router.get('/', generationController.getAll);
router.get('/:id', generationController.getById);

// WRITE: chỉ admin mới được tạo/sửa/xóa khóa
router.post('/', requirePermission('system:manage:gen'), generationController.create);

router.put('/:id', requirePermission('system:manage:gen'), generationController.update);

router.delete('/:id', requirePermission('system:manage:gen'), generationController.delete);

router.patch('/:id/set-current', requirePermission('system:manage:gen'), generationController.setCurrent);

export default router;
