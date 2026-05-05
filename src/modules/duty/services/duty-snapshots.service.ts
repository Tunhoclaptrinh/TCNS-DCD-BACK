import DutySnapshot from '../schemas/duty-snapshot.schema';
import { Identifier } from '@app-types/common';

class DutySnapshotsService {
  async createSnapshot(data: any, userId: any) {
    const snapshot = new DutySnapshot({
      ...data,
      createdBy: userId,
    });
    return await snapshot.save();
  }

  async getSnapshots(filters: any = {}) {
    return await DutySnapshot.find(filters).populate('createdBy', 'name studentId avatar').sort({ createdAt: -1 });
  }

  async getSnapshotById(id: string) {
    return await DutySnapshot.findById(id).populate('createdBy', 'name studentId avatar');
  }

  async deleteSnapshot(id: string) {
    return await DutySnapshot.findByIdAndDelete(id);
  }
}

export const dutySnapshotsService = new DutySnapshotsService();
export default dutySnapshotsService;
