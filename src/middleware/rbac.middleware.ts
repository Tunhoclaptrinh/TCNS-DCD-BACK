import { getRolePermissions as resolveRolePermissions, hasPermission } from '@shared/security/permission-policy';

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
type RateLimitRecord = { count: number; resetTime: number };

export const checkPermission = (permission) => {
  return (req, res, next) => {
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

export const roleBasedRateLimit = (limits) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || req.ip;
    const key = `${userRole}:${userId}`;
    const now = Date.now();

    let record = rateLimitStore.get(key);

    if (!record || now > record.resetTime) {
      record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW_MS };
      rateLimitStore.set(key, record);
    }

    const limit = limits[userRole] || limits.guest || 100;

    if (record.count >= limit) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded',
      });
    }

    record.count++;
    next();
  };
};

export const getUserPermissions = (req, res) => {
  const userRole = req.user?.role;
  res.json({
    success: true,
    data: { role: userRole, permissions: resolveRolePermissions(userRole) },
  });
};
