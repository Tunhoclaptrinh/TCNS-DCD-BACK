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
    let doc = await Model.findOne({ key }).lean();
    if (!doc && (key === 'DEPARTMENT_CONFIGS' || key === 'DEPARTMENTCONFIGS')) {
      // Fallback check between DEPARTMENT_CONFIGS and DEPARTMENTCONFIGS
      const altKey = key === 'DEPARTMENT_CONFIGS' ? 'DEPARTMENTCONFIGS' : 'DEPARTMENT_CONFIGS';
      doc = await Model.findOne({ key: altKey }).lean();
      if (doc) {
        doc.key = key; // Return as requested key
      }
    } else if (doc && (key === 'DEPARTMENT_CONFIGS' || key === 'DEPARTMENTCONFIGS')) {
      // Check if the other variant exists and has a newer update or longer content
      const altKey = key === 'DEPARTMENT_CONFIGS' ? 'DEPARTMENTCONFIGS' : 'DEPARTMENT_CONFIGS';
      const altDoc = await Model.findOne({ key: altKey }).lean();
      if (altDoc) {
        const docTime = new Date(doc.updatedAt || doc.createdAt || 0).getTime();
        const altTime = new Date(altDoc.updatedAt || altDoc.createdAt || 0).getTime();
        if (altTime > docTime || (altDoc.value && altDoc.value.length > (doc.value || '').length)) {
          // Sync canonical DEPARTMENT_CONFIGS to have the newer value
          await Model.updateOne(
            { key: 'DEPARTMENT_CONFIGS' },
            { $set: { value: altDoc.value, updatedAt: new Date() } },
            { upsert: true },
          );
          await Model.deleteOne({ key: 'DEPARTMENTCONFIGS' });
          doc = await Model.findOne({ key: 'DEPARTMENT_CONFIGS' }).lean();
        }
      }
    }

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
      departmentConfigs: 'DEPARTMENT_CONFIGS',
      departmentconfigs: 'DEPARTMENT_CONFIGS',
      DEPARTMENTCONFIGS: 'DEPARTMENT_CONFIGS',
      DEPARTMENT_CONFIGS: 'DEPARTMENT_CONFIGS',
      positionConfigs: 'POSITION_CONFIGS',
      positionconfigs: 'POSITION_CONFIGS',
      POSITIONCONFIGS: 'POSITION_CONFIGS',
      POSITION_CONFIGS: 'POSITION_CONFIGS',
      dutyViolationTypes: 'DUTY_VIOLATION_TYPES',
      dutyviolationtypes: 'DUTY_VIOLATION_TYPES',
      DUTY_VIOLATION_TYPES: 'DUTY_VIOLATION_TYPES',
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
          type: ['DUTY_VIOLATION_TYPES', 'DEPARTMENT_CONFIGS', 'POSITION_CONFIGS'].includes(dbKey) ? 'json' : 'string',
          updatedBy: req.user?.id,
        });
      }

      // Cleanup duplicate legacy keys if saving DEPARTMENT_CONFIGS
      if (dbKey === 'DEPARTMENT_CONFIGS') {
        await Model.deleteOne({ key: 'DEPARTMENTCONFIGS' });
      }

      // Bi-directional sync with duty_settings
      if (dbKey === 'DUTY_VIOLATION_TYPES') {
        try {
          const dutySettingsRepository = (await import('@modules/duty/repositories/duty-settings.repository')).default;
          const globalDutySettings = await dutySettingsRepository.getGlobalSettings();
          const parsed = typeof value === 'string' ? JSON.parse(value) : value;
          if (Array.isArray(parsed)) {
            if (globalDutySettings) {
              await dutySettingsRepository.update(globalDutySettings.id, {
                violationTypes: parsed,
                updatedAt: new Date().toISOString(),
              });
            } else {
              await dutySettingsRepository.create({
                violationTypes: parsed,
                updatedAt: new Date().toISOString(),
              });
            }
          }
        } catch (err) {
          console.error('Failed to sync DUTY_VIOLATION_TYPES to duty_settings:', err);
        }
      }
    }

    this.ok(res, { success: true, message: 'Settings updated successfully' });
  });
}

export default new SystemSettingController();
