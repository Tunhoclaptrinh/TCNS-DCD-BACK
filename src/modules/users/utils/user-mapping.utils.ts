import { AnyRecord } from '@app-types/common';

/**
 * Mapping of Role Keys to their IDs as defined in seed-rbac.ts
 */
export const ROLE_MAP = {
  ADMIN: 1,
  NS_LEADER: 2,
  NS_SUB_LEADER: 3,
  NS_SPECIALIST: 4,
  OTHER_LEADER: 5,
  OTHER_SUB_LEADER: 6,
  MEMBER: 7,
  CTV: 8,
};

/**
 * Logic to determine suggested roles based on position and department
 */
export const getSuggestedRoles = (position: string, department?: string): number[] => {
  if (!position) return [];

  switch (position) {
    case 'dt':
    case 'ctc':
      return [ROLE_MAP.ADMIN];

    case 'tb':
      return department === 'Nhân sự' ? [ROLE_MAP.NS_LEADER] : [ROLE_MAP.OTHER_LEADER];

    case 'pb':
      return department === 'Nhân sự' ? [ROLE_MAP.NS_SUB_LEADER] : [ROLE_MAP.OTHER_SUB_LEADER];

    case 'tvb':
      return department === 'Nhân sự' ? [ROLE_MAP.NS_SPECIALIST] : [ROLE_MAP.MEMBER];

    case 'tv':
      return [ROLE_MAP.MEMBER];

    case 'ctv':
      return [ROLE_MAP.CTV];

    default:
      return [ROLE_MAP.MEMBER];
  }
};
