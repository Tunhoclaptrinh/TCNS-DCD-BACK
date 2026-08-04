import express from 'express';
import generationController from '@modules/generations/controllers/generation.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = express.Router();

// Tất cả các route yêu cầu đăng nhập
router.use(requireAuth);

// GET: chỉ cần quyền xem để lọc danh sách, dropdown (settings:view hoặc system:manage:gen)
router.get('/', requirePermission('settings:view'), generationController.getAll);
router.get('/:id', requirePermission('settings:view'), generationController.getById);

// WRITE: chỉ admin mới được tạo/sửa/xóa khóa
router.post('/', requirePermission('system:manage:gen'), generationController.create);

router.put('/:id', requirePermission('system:manage:gen'), generationController.update);

router.delete('/:id', requirePermission('system:manage:gen'), generationController.delete);

router.patch('/:id/set-current', requirePermission('system:manage:gen'), generationController.setCurrent);

export default router;
