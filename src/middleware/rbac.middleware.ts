import type { NextFunction, Request, Response } from 'express';
import db from '@database/mongo-database.adapter';

const VIEW_ONLY_PERMISSIONS = [
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

function sendForbiddenResponse(res: Response, message: string) {
  return res.status(403).json({
    success: false,
    message,
  });
}

async function getCurrentGenerationId() {
  const settings = await db.findAll('duty_settings');
  return settings?.[0]?.currentGenerationId || settings?.[0]?.currentGeneration;
}

function hasArchivedGenerationRestriction(userGenerationId: unknown, currentGenerationId: unknown) {
  return currentGenerationId && userGenerationId && String(userGenerationId) !== String(currentGenerationId);
}

function hasDirectPermission(userPermissions: string[], permission: string) {
  return (
    userPermissions.includes(permission) ||
    (permission === 'duty:view' && userPermissions.includes('duty:view:all')) ||
    (permission === 'users:list' &&
      (userPermissions.includes('users:list:all') || userPermissions.includes('users:list:dept')))
  );
}

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
      const currentGenId = await getCurrentGenerationId();

      if (hasArchivedGenerationRestriction(userGenerationId, currentGenId)) {
        if (!VIEW_ONLY_PERMISSIONS.includes(permission)) {
          return sendForbiddenResponse(res, 'Tài khoản thuộc thế hệ cũ. Bạn chỉ có quyền xem dữ liệu.');
        }
      }
    }

    // 2. Kiểm tra quyền trực tiếp (Tính cả Đa vai trò và Ghi đè cá nhân)
    if (!hasDirectPermission(userPermissions, permission) && !isAdmin) {
      return sendForbiddenResponse(res, `Bạn không có quyền thực hiện hành động này: ${permission}`);
    }

    next();
  };
};
