import { AnyRecord } from '@app-types/common';

/**
 * Mapping of Role Keys to their IDs as defined in seed-rbac.ts
 */
export const ROLE_MAP = {
  ADMIN: 1,
  NS_LEADER: 2,
  NS_SUB_LEADER: 3,
  NS_SPECIALIST: 4,
  TC_LEADER: 10,
  TC_SUB_LEADER: 11,
  TT_LEADER: 12,
  TT_SUB_LEADER: 13,
  OTHER_LEADER: 5,
  OTHER_SUB_LEADER: 6,
  MEMBER: 7,
  CTV: 8,
};

import db from '@database/mongo-database.adapter';

/**
 * Logic to determine suggested roles based on position and department (Async with DB lookup)
 */
export const getSuggestedRolesAsync = async (position: string, department?: string): Promise<number[]> => {
  if (!position) return [];
  const dept = department || '';

  if (position === 'dt') return [ROLE_MAP.ADMIN];
  if (position === 'ctv') return [ROLE_MAP.CTV];
  if (position === 'tv') return [ROLE_MAP.MEMBER];

  try {
    const Model = (db as any).getModel('system_settings');
    if (Model) {
      const settingDoc = await Model.findOne({ key: 'DEPARTMENT_CONFIGS' }).lean();
      if (settingDoc && settingDoc.value) {
        const configs = typeof settingDoc.value === 'string' ? JSON.parse(settingDoc.value) : settingDoc.value;
        if (Array.isArray(configs)) {
          const config =
            configs.find((c: any) => c.name === dept || c.id === dept) || configs.find((c: any) => c.id === 'khac');
          if (config && config.roles && config.roles[position]) {
            const mappedRoleKeys = Array.isArray(config.roles[position])
              ? config.roles[position]
              : [config.roles[position]];
            const roleModel = (db as any).getModel('roles');
            if (roleModel) {
              const rolesInDb = await roleModel.find({ key: { $in: mappedRoleKeys } }).lean();
              if (rolesInDb && rolesInDb.length > 0) {
                return rolesInDb.map((r: any) => r.id);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    // Fallback to static mapping if DB lookup fails
  }

  return getSuggestedRoles(position, department);
};

/**
 * Sync logic to determine suggested roles based on position and department (Fallback)
 */
export const getSuggestedRoles = (position: string, department?: string): number[] => {
  if (!position) return [];

  const dept = department || '';

  switch (position) {
    case 'dt':
      return [ROLE_MAP.ADMIN];

    case 'tb':
      if (dept === 'Nhân sự') return [ROLE_MAP.NS_LEADER];
      if (dept === 'Tài chính') return [ROLE_MAP.TC_LEADER];
      if (dept === 'Truyền thông') return [ROLE_MAP.TT_LEADER];
      return [ROLE_MAP.OTHER_LEADER];

    case 'pb':
      if (dept === 'Nhân sự') return [ROLE_MAP.NS_SUB_LEADER];
      if (dept === 'Tài chính') return [ROLE_MAP.TC_SUB_LEADER];
      if (dept === 'Truyền thông') return [ROLE_MAP.TT_SUB_LEADER];
      return [ROLE_MAP.OTHER_SUB_LEADER];

    case 'tvb':
      return dept === 'Nhân sự' ? [ROLE_MAP.NS_SPECIALIST] : [ROLE_MAP.MEMBER];

    case 'tv':
      return [ROLE_MAP.MEMBER];

    case 'ctv':
      return [ROLE_MAP.CTV];

    default:
      return [ROLE_MAP.MEMBER];
  }
};
