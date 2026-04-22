import BaseService from '@shared/common/base-service';
import rolesRepository from '@modules/roles/repositories/roles.repository';
import roleSchema from '@modules/roles/schemas/role.schema';

class RoleService extends BaseService {
  constructor() {
    super('roles', rolesRepository);
  }

  getSchema() {
    return roleSchema;
  }
}

export default new RoleService();
