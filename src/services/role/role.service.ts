import BaseService from '@shared/common/base-service';
import roleSchema from '../../schemas/role.schema';

class RoleService extends BaseService {
  constructor() {
    super('roles');
  }

  getSchema() {
    return roleSchema;
  }
}

export default new RoleService();
