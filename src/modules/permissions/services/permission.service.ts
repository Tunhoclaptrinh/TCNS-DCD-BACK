import BaseService from '@shared/common/base-service';
import permissionsRepository from '@modules/permissions/repositories/permissions.repository';
import permissionSchema from '@modules/permissions/schemas/permission.schema';

class PermissionService extends BaseService {
  constructor() {
    super('permissions', permissionsRepository);
  }

  getSchema() {
    return permissionSchema;
  }
}

export default new PermissionService();
