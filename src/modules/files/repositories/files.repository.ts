import BaseRepository from '@shared/repositories/base.repository';

class FilesRepository extends BaseRepository {
  constructor() {
    super('files');
  }

  async findByStorageId(idFile: string) {
    return await this.findOne({ idFile });
  }
}

export default new FilesRepository();
