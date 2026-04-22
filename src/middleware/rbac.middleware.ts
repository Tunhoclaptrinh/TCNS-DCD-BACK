import type { NextFunction, Request, Response } from 'express';
import { hasPermission } from '@shared/security/permission-policy';
import db from '@database';

// Kiểm tra role hiện tại có quyền thực hiện action được yêu cầu hay không.
export const requirePermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    let userRole = req.user?.role;
    const userDepartment = req.user?.department;
    const userGenerationId = req.user?.generationId;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập',
      });
    }

    // 1. HR Department specialists get Staff role automatically
    if (userDepartment === 'Ban Nhân sự' && userRole === 'customer') {
      userRole = 'staff';
    }

    // 2. Archive Logic: Generation Check
    // If user is from an older generation, they only get view-only permissions
    // unless they are explicitly an admin.
    if (userRole !== 'admin') {
      const settings = await db.findAll('duty_settings');
      const currentGenId = settings?.[0]?.currentGenerationId || settings?.[0]?.currentGeneration;

      if (currentGenId && userGenerationId && String(userGenerationId) !== String(currentGenId)) {
        // Only allow view-only permissions for old generations
        const viewOnlyPermissions = [
          'users:list',
          'users:read',
          'dashboard:view',
          'reports:view',
          'duty:view',
          'reward_penalty:view',
          'profile:read',
          'profile:update',
        ];

        if (!viewOnlyPermissions.includes(permission)) {
          return res.status(403).json({
            success: false,
            message: `Tài khoản thuộc thế hệ cũ. Bạn chỉ có quyền xem dữ liệu.`,
          });
        }
        return next();
      }
    }

    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền: ${permission}`,
      });
    }

    next();
  };
};
