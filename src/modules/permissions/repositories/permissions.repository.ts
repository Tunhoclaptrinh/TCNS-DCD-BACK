import BaseRepository from '@shared/repositories/base.repository';

class PermissionsRepository extends BaseRepository {
  constructor() {
    super('permissions');
  }
}

export default new PermissionsRepository();
