import type { NextFunction, Request, Response } from 'express';
import db from '@database';

/**
 * Middleware kiểm tra quyền hạn của người dùng.
 * Hỗ trợ cả kiểm tra quyền trực tiếp và logic tự động chuyển Read-only cho thế hệ cũ.
 */
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập',
      });
    }

    const userPermissions: string[] = user.permissions || [];
    const isAdmin = userPermissions.includes('*') || user.role === 'admin';
    const userGenerationId = user.generationId;

    // 1. Logic Thế hệ cũ (Archive): Tự động giới hạn quyền nếu không phải Admin
    if (!isAdmin) {
      const settings = await db.findAll('duty_settings');
      const currentGenId = settings?.[0]?.currentGenerationId || settings?.[0]?.currentGeneration;

      if (currentGenId && userGenerationId && String(userGenerationId) !== String(currentGenId)) {
        // Danh sách quyền được phép cho thế hệ cũ
        const viewOnlyPermissions = [
          'users:list:all',
          'users:list:dept',
          'users:read:all',
          'users:read:self',
          'duty:view',
          'reward:view:all',
          'reward:view:self',
          'dashboard:view',
          'reports:view',
        ];

        if (!viewOnlyPermissions.includes(permission)) {
          return res.status(403).json({
            success: false,
            message: `Tài khoản thuộc thế hệ cũ. Bạn chỉ có quyền xem dữ liệu.`,
          });
        }
      }
    }

    // 2. Kiểm tra quyền trực tiếp (Tính cả Đa vai trò và Ghi đè cá nhân)
    const hasDirectPermission =
      userPermissions.includes(permission) || (permission === 'duty:view' && userPermissions.includes('duty:view:all'));

    if (!hasDirectPermission && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền thực hiện hành động này: ${permission}`,
      });
    }

    next();
  };
};
