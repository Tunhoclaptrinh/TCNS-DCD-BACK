/**
 * PERMISSIONS - Định nghĩa các quyền cơ bản theo vai trò
 * Mỗi quyền là một chuỗi 'resource:action'
 */
const PERMISSIONS = {
  admin: ['*'], // Toàn quyền

  researcher: [
    'users:list',
    'users:read',
    'dashboard:view'
  ],

  customer: [
    'profile:read',
    'profile:update',
    'dashboard:view'
  ]
};

/**
 * Check if a role has a specific permission
 */
const hasPermission = (role, permission) => {
  const rolePermissions = PERMISSIONS[role] || [];

  // Admin bypass
  if (rolePermissions.includes('*')) return true;

  return rolePermissions.includes(permission);
};

/**
 * Middleware: Check permission
 * @param {string} permission - Quyền cần kiểm tra (ví dụ: 'users:create')
 */
exports.checkPermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'Yêu cầu đăng nhập'
      });
    }

    if (!hasPermission(userRole, permission)) {
      return res.status(403).json({
        success: false,
        message: `Bạn không có quyền: ${permission}`
      });
    }

    next();
  };
};

/**
 * Helper to get all permissions for a role
 */
exports.getRolePermissions = (role) => {
  return PERMISSIONS[role] || [];
};

/**
 * Middleware: Rate limiting (Giữ nguyên logic nhưng đổi config nếu cần)
 */
const rateLimitStore = {};
exports.roleBasedRateLimit = (limits) => {
  return (req, res, next) => {
    const userRole = req.user?.role || 'guest';
    const userId = req.user?.id || req.ip;
    const key = `${userRole}:${userId}`;
    const now = Date.now();
    const windowMs = 60 * 60 * 1000; // 1 hour

    if (!rateLimitStore[key]) {
      rateLimitStore[key] = { count: 0, resetTime: now + windowMs };
    }

    const record = rateLimitStore[key];
    if (now > record.resetTime) {
      record.count = 0;
      record.resetTime = now + windowMs;
    }

    const limit = limits[userRole] || limits.guest || 100;

    if (record.count >= limit) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded'
      });
    }

    record.count++;
    next();
  };
};

exports.getUserPermissions = (req, res) => {
  const userRole = req.user?.role;
  res.json({
    success: true,
    data: { role: userRole, permissions: PERMISSIONS[userRole] || {} }
  });
};

module.exports = exports;