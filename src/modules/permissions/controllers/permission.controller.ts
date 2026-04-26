import BaseController from '@shared/common/base-controller';
import permissionService from '@modules/permissions/services/permission.service';

class PermissionController extends BaseController {
  constructor() {
    super(permissionService);
  }
}

export default new PermissionController();
