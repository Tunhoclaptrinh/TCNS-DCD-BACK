import BaseRepository from '@shared/repositories/base.repository';

class DutySlotsRepository extends BaseRepository {
  constructor() {
    super('duty_slots');
  }

  async findByShiftDate(shiftDate: string) {
    return await this.findMany({ shiftDate });
  }
}

export default new DutySlotsRepository();
