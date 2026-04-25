import BaseRepository from '@shared/repositories/base.repository';

class DutyTemplatesRepository extends BaseRepository {
  constructor() {
    super('duty_templates');
  }

  async findDefault() {
    return await this.findOne({ type: 'group', isDefault: true });
  }

  async findGroups() {
    return await this.findMany({ type: 'group' });
  }

  async findShiftsByGroupId(groupId: string | number) {
    return await this.findMany({ type: 'shift', parentId: groupId });
  }

  async findKipsByShiftId(shiftId: string | number) {
    return await this.findMany({ type: 'kip', parentId: shiftId });
  }

  async deleteByParentId(parentId: string | number) {
    return await this.deleteMany({ parentId });
  }
}

export default new DutyTemplatesRepository();
