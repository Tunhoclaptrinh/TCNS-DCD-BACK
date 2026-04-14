import BaseController from '@shared/common/base-controller';
import roleService from '../services/role/role.service';

class RoleController extends BaseController {
  constructor() {
    super(roleService);
  }
}

export default new RoleController();
