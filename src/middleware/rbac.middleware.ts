import type { NextFunction, Request, Response } from 'express';
import { getRolePermissions as resolveRolePermissions, hasPermission } from '@shared/security/permission-policy';

const ROLE_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
type RateLimitRecord = { count: number; resetTime: number };

export const requirePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập',
      });
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

export const getRolePermissions = (role) => {
  return resolveRolePermissions(role);
};

const rateLimitStore = new Map<string, RateLimitRecord>();

export const roleRateLimit = (limitsByRole: Record<string, number>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || req.ip;
    const key = `${userRole}:${userId}`;
    const now = Date.now();

    let rateLimitRecord = rateLimitStore.get(key);

    if (!rateLimitRecord || now > rateLimitRecord.resetTime) {
      rateLimitRecord = { count: 0, resetTime: now + ROLE_RATE_LIMIT_WINDOW_MS };
      rateLimitStore.set(key, rateLimitRecord);
    }

    const requestLimit = limitsByRole[userRole] || limitsByRole.guest || 100;

    if (rateLimitRecord.count >= requestLimit) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
      });
    }

    rateLimitRecord.count++;
    next();
  };
};

export const getPermissions = (req: Request, res: Response) => {
  const userRole = req.user?.role;
  res.json({
    success: true,
    data: { role: userRole, permissions: resolveRolePermissions(userRole) },
  });
};
