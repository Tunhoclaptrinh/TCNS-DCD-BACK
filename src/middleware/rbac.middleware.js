const PERMISSIONS = {
  admin: ['*'],
  researcher: ['users:list', 'users:read', 'dashboard:view'],
  customer: ['profile:read', 'profile:update', 'dashboard:view'],
};

const ADMIN_WILDCARD = '*';
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function hasPermission(role, permission) {
  const rolePermissions = PERMISSIONS[role];
  if (!rolePermissions) return false;
  if (rolePermissions.includes(ADMIN_WILDCARD)) return true;
  return rolePermissions.includes(permission);
}

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
  return PERMISSIONS[role] || [];
};

const rateLimitStore = new Map();

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
    data: { role: userRole, permissions: PERMISSIONS[userRole] || [] },
  });
};
