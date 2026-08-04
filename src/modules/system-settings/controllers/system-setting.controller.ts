import { Request, Response } from 'express';
import BaseController from '@shared/common/base-controller';
import BaseService from '@shared/common/base-service';
import db from '@database/mongo-database.adapter';

class SystemSettingController extends BaseController {
  constructor() {
    super(new BaseService('system_settings'));
  }

  // Bulk update settings by key
  bulkUpdateSettings = this.handle(async (req: Request, res: Response) => {
    const settings = req.body;
    const Model = (db as any).getModel('system_settings');

    if (!Model) {
      return res.status(500).json({ message: 'Model not found' });
    }

    const updates = [];
    for (const [key, value] of Object.entries(settings)) {
      updates.push(
        Model.findOneAndUpdate({ key }, { value: String(value), updatedBy: req.user?.id }, { upsert: true, new: true }),
      );
    }

    await Promise.all(updates);

    this.ok(res, { success: true, message: 'Settings updated successfully' });
  });
}

export default new SystemSettingController();
