import { Identifier } from '@app-types/common';
import BaseRepository from '@shared/repositories/base.repository';

class DutySlotsRepository extends BaseRepository {
  constructor() {
    super('duty_slots');
  }

  async findById(id: Identifier) {
    const Model = (this.database as any).getModel(this.collection);
    if (!Model) return null;

    const query: any = {};
    if (/^\d+$/.test(String(id))) {
      query.id = parseInt(String(id), 10);
    } else {
      query._id = id;
    }

    const doc = await Model.findOne(query)
      .populate('kip')
      .populate('shift')
      .populate('assignedUsers')
      .populate('attendedUsers')
      .lean();

    return (this.database as any).mapId(doc);
  }

  async findByShiftDate(shiftDate: string) {
    return await this.findMany({ shiftDate });
  }
}

export default new DutySlotsRepository();
