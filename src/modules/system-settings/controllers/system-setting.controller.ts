import { Request, Response } from 'express';
import BaseController from '@shared/common/base-controller';
import BaseService from '@shared/common/base-service';
import db from '@database/mongo-database.adapter';

class SystemSettingController extends BaseController {
  constructor() {
    super(new BaseService('system_settings'));
  }

  getAll = this.handle(async (_req: Request, res: Response) => {
    const Model = (db as any).getModel('system_settings');
    if (!Model) {
      return this.ok(res, []);
    }
    const docs = await Model.find({}).lean();
    this.ok(res, docs);
  });

  getByKey = this.handle(async (req: Request, res: Response) => {
    const key = req.params.key;
    const Model = (db as any).getModel('system_settings');
    if (!Model) {
      return res.status(404).json({ message: 'Settings model not found' });
    }
    const doc = await Model.findOne({ key }).lean();
    if (!doc) {
      return res.status(404).json({ message: 'Setting not found' });
    }
    this.ok(res, doc);
  });

  // Bulk update settings by key
  bulkUpdateSettings = this.handle(async (req: Request, res: Response) => {
    const settings = req.body;
    const Model = (db as any).getModel('system_settings');

    if (!Model) {
      return res.status(500).json({ message: 'Model not found' });
    }

    // Mapping for camelCase body keys to original uppercase setting keys
    const keyMap: Record<string, string> = {
      defaultImportPasswordStrategy: 'DEFAULT_IMPORT_PASSWORD_STRATEGY',
      defaultimportpasswordstrategy: 'DEFAULT_IMPORT_PASSWORD_STRATEGY',
      defaultImportPassword: 'DEFAULT_IMPORT_PASSWORD',
      defaultimportpassword: 'DEFAULT_IMPORT_PASSWORD',
      allowedIpRanges: 'ALLOWED_IP_RANGES',
      allowedipranges: 'ALLOWED_IP_RANGES',
    };

    for (const [rawKey, value] of Object.entries(settings)) {
      const dbKey = keyMap[rawKey] || keyMap[rawKey.toLowerCase()] || rawKey;
      const existing = await Model.findOne({ key: dbKey });

      if (existing) {
        existing.value = String(value ?? '');
        existing.updatedBy = req.user?.id;
        await existing.save();
      } else {
        const nextId = await db.getNextId('system_settings');
        await Model.create({
          id: nextId,
          key: dbKey,
          value: String(value ?? ''),
          type: 'string',
          updatedBy: req.user?.id,
        });
      }
    }

    this.ok(res, { success: true, message: 'Settings updated successfully' });
  });
}

export default new SystemSettingController();
