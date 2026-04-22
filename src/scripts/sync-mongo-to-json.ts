import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Load .env
dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;
const DB_FILE = path.resolve(process.cwd(), 'src/database/db.json');

const SCHEMA_MODEL_MAP: Record<string, string> = {
  'user.schema': 'users',
  'notification.schema': 'notifications',
  'notification-setting.schema': 'notification_settings',
  'file.schema': 'files',
  'duty-slot.schema': 'duty_slots',
  'duty-shift.schema': 'duty_shifts',
  'duty-kip.schema': 'duty_kips',
  'duty-swap-request.schema': 'duty_swap_requests',
  'duty-leave-request.schema': 'duty_leave_requests',
  'reward-penalty.schema': 'reward_penalties',
  'duty-day.schema': 'duty_days',
  'duty-template.schema': 'duty_templates',
  'duty-template-assignment.schema': 'duty_template_assignments',
  'duty-log.schema': 'duty_logs',
};

async function sync() {
  if (!DATABASE_URL) {
    console.error('❌ DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  console.log('🔌 Connecting to MongoDB...');
  await mongoose.connect(DATABASE_URL);
  console.log('✅ Connected.');

  const schemasDir = path.resolve(process.cwd(), 'src/schemas');
  const files = fs.readdirSync(schemasDir);
  const dbData: Record<string, any[]> = {};

  // Initialize empty arrays for all collections
  Object.values(SCHEMA_MODEL_MAP).forEach((collection) => {
    dbData[collection] = [];
  });

  for (const file of files) {
    const fileName = file.replace(/\.(ts|js)$/, '');
    const collectionName = SCHEMA_MODEL_MAP[fileName];
    if (!collectionName) continue;

    try {
      console.log(`📦 Processing collection: ${collectionName}...`);
      const schemaPath = pathToFileURL(path.join(schemasDir, file)).href;
      const schemaDef = (await import(schemaPath)).default;

      if (!schemaDef || typeof schemaDef !== 'object') continue;

      const mongooseFields: Record<string, any> = {
        id: { type: Number, unique: true, index: true },
      };

      for (const [key, val] of Object.entries(schemaDef)) {
        if (key === 'custom') continue;
        const v = val as any;
        let type: any = String;
        if (v.type === 'number') type = Number;
        if (v.type === 'boolean') type = Boolean;
        if (v.type === 'date') type = Date;
        if (v.type === 'array') type = Array;
        if (v.type === 'object') type = mongoose.Schema.Types.Mixed;
        if (v.foreignKey) type = Number;

        mongooseFields[key] = {
          type: type,
        };
      }

      // Avoid "OverwriteModelError: Cannot overwrite `users` model once compiled."
      const Model =
        mongoose.models[collectionName] ||
        mongoose.model(collectionName, new mongoose.Schema(mongooseFields, { timestamps: true }));

      const docs = await Model.find({}).lean();

      dbData[collectionName] = docs.map((doc: any) => {
        const item = { ...doc };
        // Clean up MongoDB specific fields
        delete item._id;
        delete item.__v;
        // Ensure id is present (if numeric id was used)
        if (!item.id && doc._id) {
          // If no numeric id, we might have an issue, but let's assume it exists or fallback
          // Based on Schema logic, it seems they use numeric 'id'
        }
        return item;
      });

      console.log(`✅ Fetched ${dbData[collectionName].length} items for ${collectionName}`);
    } catch (error) {
      console.error(`❌ Error processing ${file}:`, error);
    }
  }

  console.log(`💾 Saving data to ${DB_FILE}...`);
  fs.writeFileSync(DB_FILE, JSON.stringify(dbData, null, 2));
  console.log('✨ All done!');

  await mongoose.disconnect();
}

sync().catch((err) => {
  console.error('💥 Sync failed:', err);
  process.exit(1);
});
