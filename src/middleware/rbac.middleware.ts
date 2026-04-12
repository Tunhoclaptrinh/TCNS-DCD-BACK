import db from '@config/database';

const PERMISSIONS = {
  admin: ['*'],
  staff: [
    'users:list',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'users:manage_status',
    'users:view_stats',
    'users:manage_rank',
    'users:expel',
    'dashboard:view',
    'duty:view',
    'duty:register',
    'duty:update',
    'duty:manage',
    'duty:approve_swap',
    'duty:approve_leave',
    'reward_penalty:view',
    'reward_penalty:manage',
    'reports:view',
    'reports:export',
  ],
  customer: [
    'profile:read',
    'profile:update',
    'dashboard:view',
    'duty:view',
    'duty:register',
    'duty:update',
    'reward_penalty:view',
  ],
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
  return async (req, res, next) => {
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
