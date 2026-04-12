import BaseService from '@utils/base-service';
import roleSchema from '@schemas/role.schema';

class RoleService extends BaseService {
  constructor() {
    super('roles');
  }

  getSchema() {
    return roleSchema;
  }
}

export default new RoleService();
