import BaseRepository from '@shared/repositories/base.repository';
import type { Identifier } from '@app-types/common';

class UsersRepository extends BaseRepository {
  constructor() {
    super('users');
  }

  async findByEmail(email: string) {
    return await this.findOne({ email });
  }

  async updateLastLogin(userId: Identifier, loginTime: string) {
    return await this.update(userId, {
      lastLogin: loginTime,
      updatedAt: loginTime,
    });
  }
}

export default new UsersRepository();
