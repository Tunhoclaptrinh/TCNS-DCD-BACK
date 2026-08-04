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
  if (userPermissions.includes(permission)) return true;

  // ── Alias map: route permission → accepted seed permissions ──────────────
  const aliases: Record<string, string[]> = {
    // Users
    'users:list': ['users:list:all', 'users:list:dept'],
    'users:update': ['users:update:profile', 'users:update:org', 'users:promote', 'users:expel'],
    'users:import_export': ['users:import', 'users:export'],
    'users:manage_status': ['users:update:org', 'users:expel'],
    'dashboard:view': ['users:list:all', 'users:list:dept', 'duty:view', 'meeting:view'],
    'users:list:all': ['users:list:all'], // exact
    'users:list:dept': ['users:list:dept'], // exact

    // Duty (alias để tương thích)
    'duty:view': ['duty:view', 'duty:view:all'],

    // Meetings (meetings routes đang dùng nhầm duty:*)
    'meeting:view': ['meeting:view'],
    'meeting:create': ['meeting:create:all', 'meeting:create:dept'],

    // Reward penalties
    'reward_penalty:view': ['reward:history:all', 'reward:stats:all', 'reward:stats:dept'],
    'reward_penalty:manage': ['reward:create', 'reward:approve'],

    // Semesters / Settings
    'settings:manage': ['system:manage'],

    // Reports
    'reports:view': ['duty:manage', 'reward:stats:all'],
    'reports:export': ['duty:manage', 'reward:stats:all'],
  };

  const accepted = aliases[permission];
  if (accepted) {
    return accepted.some((p) => userPermissions.includes(p));
  }

  return false;
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
    const isAdmin = userPermissions.includes('*');
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
