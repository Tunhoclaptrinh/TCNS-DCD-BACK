/**
 * RBAC Middleware - Role-Based Access Control
 * Updated for SEN (Cultural Heritage Game)
 */

const PERMISSIONS = {
  // 1. Admin: Quyền lực tuyệt đối
  admin: {
    users: ['create', 'read', 'update', 'delete', 'list', 'block'],
    heritage_sites: ['create', 'read', 'update', 'delete', 'list', 'publish'],
    artifacts: ['create', 'read', 'update', 'delete', 'list'],
    game_content: ['create', 'read', 'update', 'delete', 'list', 'import', 'export'], // Levels, Chapters, Characters
    system: ['view_logs', 'view_stats', 'backup']
  },

  // 2. Researcher: Nhà nghiên cứu/Biên tập viên
  researcher: {
    heritage_sites: ['create', 'read', 'update', 'list'], // Không được delete
    artifacts: ['create', 'read', 'update', 'list'],
    game_content: ['read', 'list', 'suggest'], // Chỉ xem content game
    users: ['read'] // Xem profile cơ bản
  },

  // 3. Customer: Người chơi
  customer: {
    heritage_sites: ['read', 'list'],
    artifacts: ['read', 'list'],
    game_play: ['play', 'submit_score', 'collect_reward', 'earn_rewards', 'scan_qr'],
    user_data: ['read_own', 'update_own', 'delete_own'], // Collections, Favorites, Progress
    shop: ['purchase', 'use_item']
  }
};

/**
 * Check permission helper
 */
function hasPermission(userRole, resource, action) {
  const rolePermissions = PERMISSIONS[userRole];
  if (!rolePermissions) return false;

  // Admin bypass
  if (userRole === 'admin') return true;

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action);
}

/**
 * Middleware: Check permission
 * Usage: checkPermission('heritage_sites', 'create')
 */
exports.checkPermission = (resource, action) => {
  return (req, res, next) => {
    const userRole = req.user?.role;

    if (!userRole) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!hasPermission(userRole, resource, action)) {
      return res.status(403).json({
        success: false,
        message: `Permission denied. Role '${userRole}' cannot '${action}' on '${resource}'`
      });
    }

    next();
  };
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