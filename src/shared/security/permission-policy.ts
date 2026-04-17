export const PERMISSIONS = {
  admin: ['*'],
  staff: [
    'users:list',
    'users:read',
    'users:create',
    'users:update',
    'users:delete',
    'users:manage_status',
    'users:view_stats',
    'users:import_export',
    'users:manage_rank',
    'users:expel',
    'dashboard:view',
    'duty:view',
    'duty:register',
    'duty:update',
    'duty:manage',
    'duty:approve_swap',
    'reward_penalty:view',
    'reward_penalty:manage',
    'reports:view',
    'reports:export',
  ],
  researcher: ['users:list', 'users:read', 'dashboard:view', 'reports:view'],
  customer: [
    'profile:read',
    'profile:update',
    'dashboard:view',
    'duty:view',
    'duty:register',
    'duty:update',
    'reward_penalty:view',
  ],
} as const;

export const ADMIN_WILDCARD = '*';

export function hasPermission(role: string | undefined, permission: string) {
  const rolePermissions = role ? (PERMISSIONS[role as keyof typeof PERMISSIONS] as readonly string[]) : undefined;

  if (!rolePermissions) {
    return false;
  }

  if (rolePermissions.includes(ADMIN_WILDCARD)) {
    return true;
  }

  return rolePermissions.includes(permission);
}

export function getRolePermissions(role: string | undefined) {
  if (!role) {
    return [];
  }

  return PERMISSIONS[role as keyof typeof PERMISSIONS] || [];
}
