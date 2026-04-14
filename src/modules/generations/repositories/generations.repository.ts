import BaseRepository from '@shared/repositories/base.repository';

class GenerationsRepository extends BaseRepository {
  constructor() {
    super('generations');
  }
}

export default new GenerationsRepository();
