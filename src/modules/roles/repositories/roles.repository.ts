import BaseRepository from '@shared/repositories/base.repository';

class RolesRepository extends BaseRepository {
  constructor() {
    super('roles');
  }
}

export default new RolesRepository();
