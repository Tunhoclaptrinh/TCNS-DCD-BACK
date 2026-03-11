import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { DatabaseAdapter, QueryOptions } from '@app-types/database';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';

const SCHEMA_MODEL_MAP = {
  'user.schema': 'users',
  'notification.schema': 'notifications',
  'notification-setting.schema': 'notification_settings',
  'duty-slot.schema': 'duty_slots',
  'duty-swap-request.schema': 'duty_swap_requests',
  'reward-penalty.schema': 'reward_penalties',
};

function stripModuleExtension(fileName: string) {
  return fileName.replace(/\.(ts|js)$/, '');
}

type RelationConfig = {
  ref: string;
  localField: string;
  foreignField: string;
  justOne?: boolean;
};

class MongoConnect implements DatabaseAdapter {
  models: Record<string, any>;
  relations: Record<string, Record<string, RelationConfig>>;

  constructor() {
    this.models = {};
    this.relations = {
      users: {
        notifications: { ref: 'notifications', localField: 'id', foreignField: 'user_id' },
        notification_settings: { ref: 'notification_settings', localField: 'id', foreignField: 'user_id' },
      },
      notifications: {
        user: { ref: 'users', localField: 'user_id', foreignField: 'id', justOne: true },
      },
      notification_settings: {
        user: { ref: 'users', localField: 'user_id', foreignField: 'id', justOne: true },
      },
      reward_penalties: {
        user: { ref: 'users', localField: 'user_id', foreignField: 'id', justOne: true },
        creator: { ref: 'users', localField: 'created_by', foreignField: 'id', justOne: true },
      },
      duty_swap_requests: {
        requester: { ref: 'users', localField: 'requester_id', foreignField: 'id', justOne: true },
        target_user: { ref: 'users', localField: 'target_user_id', foreignField: 'id', justOne: true },
        approver: { ref: 'users', localField: 'approved_by', foreignField: 'id', justOne: true },
        duty_slot: { ref: 'duty_slots', localField: 'duty_slot_id', foreignField: 'id', justOne: true },
      },
    };
  }

  castQueryValue(val: any) {
    if (val === null || val === undefined) return val;
    if (typeof val === 'number' || typeof val === 'boolean' || val instanceof Date) return val;

    const text = String(val).trim();
    if (text === '') return text;

    if (text === 'true') return true;
    if (text === 'false') return false;

    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return Number(text);
    }

    const maybeDate = new Date(text);
    if (!Number.isNaN(maybeDate.getTime())) {
      return maybeDate;
    }

    return text;
  }

  // ==================== CONNECTION ====================

  async initConnection() {
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('🔌 MongoDB Adapter Connected');
      } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        throw error;
      }
    }
  }

  // ==================== SCHEMA LOADING ====================

  async loadSchemasAsModels() {
    const schemasDir = path.join(__dirname, '../schemas');

    if (!fs.existsSync(schemasDir)) {
      console.error('❌ Schemas directory not found:', schemasDir);
      return;
    }

    const files = fs.readdirSync(schemasDir);

    for (const file of files) {
      if (stripModuleExtension(file) === 'index') continue;

      const entityName = SCHEMA_MODEL_MAP[stripModuleExtension(file)];
      if (!entityName) continue;

      try {
        const schemaPath = pathToFileURL(path.join(schemasDir, file)).href;
        const schemaDef = (await import(schemaPath)).default as SchemaDefinition;

        if (!schemaDef || typeof schemaDef !== 'object') continue;

        const mongooseFields: Record<string, any> = {};

        // Auto-increment numeric id field
        mongooseFields.id = { type: Number, unique: true, index: true };

        for (const [key, val] of Object.entries(schemaDef) as Array<[string, SchemaRule]>) {
          if (key === 'custom') continue;

          let type: any = String;
          if (val.type === 'number') type = Number;
          if (val.type === 'boolean') type = Boolean;
          if (val.type === 'date') type = Date;
          if (val.type === 'array') type = Array;
          if (val.type === 'object') type = mongoose.Schema.Types.Mixed;
          if (val.foreignKey) type = Number;

          mongooseFields[key] = {
            type: type,
            required: val.required || false,
            default: val.default,
            unique: val.unique || false,
          };

          if (val.enum) mongooseFields[key].enum = val.enum;
          if (val.min !== undefined) mongooseFields[key].min = val.min;
          if (val.max !== undefined) mongooseFields[key].max = val.max;
          if (val.minLength) mongooseFields[key].minlength = val.minLength;
          if (val.maxLength) mongooseFields[key].maxlength = val.maxLength;
        }

        if (!mongoose.models[entityName]) {
          const schema = new mongoose.Schema(mongooseFields, {
            timestamps: true,
            toJSON: {
              virtuals: true,
              versionKey: false,
              transform: function (_doc: any, ret: AnyRecord) {
                delete ret._id;
                delete ret.__v;
              },
            },
            toObject: { virtuals: true },
            id: false,
          });

          // Setup virtuals for populate
          const rels = this.relations[entityName];
          if (rels) {
            for (const [field, config] of Object.entries(rels) as Array<[string, RelationConfig]>) {
              if (!mongooseFields[field]) {
                schema.virtual(field, {
                  ref: config.ref,
                  localField: config.localField,
                  foreignField: config.foreignField,
                  justOne: config.justOne || false,
                });
              }
            }
          }

          this.models[entityName] = mongoose.model(entityName, schema);
          console.log(`✅ Model created: ${entityName}`);
        } else {
          this.models[entityName] = mongoose.models[entityName];
        }
      } catch (error: any) {
        console.error(`❌ Error loading schema ${file}:`, error.message);
      }
    }

    console.log(`📦 Total models loaded: ${Object.keys(this.models).length}`);
  }

  getModel(collection: string) {
    return this.models[collection];
  }

  // ==================== FIND ALL ADVANCED ====================

  async findAllAdvanced(collection: string, options: QueryOptions = {}) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Model not found for collection: ${collection}`);

    const query: AnyRecord = {};

    if (options.q) {
      query['$or'] = [
        { name: { $regex: options.q, $options: 'i' } },
        { title: { $regex: options.q, $options: 'i' } },
        { description: { $regex: options.q, $options: 'i' } },
        { comment: { $regex: options.q, $options: 'i' } },
      ];
    }

    if (options.filter) {
      for (const [key, val] of Object.entries(options.filter)) {
        if (key.endsWith('_gte')) {
          const field = key.replace('_gte', '');
          query[field] = { ...query[field], $gte: this.castQueryValue(val) };
        } else if (key.endsWith('_lte')) {
          const field = key.replace('_lte', '');
          query[field] = { ...query[field], $lte: this.castQueryValue(val) };
        } else if (key.endsWith('_gt')) {
          const field = key.replace('_gt', '');
          query[field] = { ...query[field], $gt: this.castQueryValue(val) };
        } else if (key.endsWith('_lt')) {
          const field = key.replace('_lt', '');
          query[field] = { ...query[field], $lt: this.castQueryValue(val) };
        } else if (key.endsWith('_ne')) {
          const field = key.replace('_ne', '');
          query[field] = { $ne: this.castQueryValue(val) };
        } else if (key.endsWith('_like')) {
          const field = key.replace('_like', '');
          query[field] = { $regex: val, $options: 'i' };
        } else if (key.endsWith('_in')) {
          const field = key.replace('_in', '');
          const values = Array.isArray(val) ? val : String(val).split(',');
          query[field] = { $in: values.map((item) => this.castQueryValue(item)) };
        } else {
          query[key] = this.castQueryValue(val);
        }
      }
    }

    const page = parseInt(String(options.page || 1), 10) || 1;
    const limit = parseInt(String(options.limit || 10), 10) || 10;
    const skip = (page - 1) * limit;

    let queryBuilder = Model.find(query);

    // Sort
    if (options.sort) {
      const sortFields = options.sort.split(',');
      const orders = options.order ? options.order.split(',') : [];
      const sortObj: Record<string, number> = {};
      sortFields.forEach((field, index) => {
        sortObj[field] = orders[index] === 'desc' ? -1 : 1;
      });
      queryBuilder = queryBuilder.sort(sortObj);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 });
    }

    // Populate
    const populateFields: string[] = [];
    if (options.embed) populateFields.push(...options.embed.split(','));
    if (options.expand) populateFields.push(...options.expand.split(','));

    for (const field of populateFields) {
      try {
        queryBuilder = queryBuilder.populate(field);
      } catch (e) {
        console.warn(`⚠️ Cannot populate ${field}`);
      }
    }

    const [data, total] = await Promise.all([queryBuilder.skip(skip).limit(limit).exec(), Model.countDocuments(query)]);

    return {
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  // ==================== CRUD METHODS ====================

  async findAll(collection: string) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    return await Model.find();
  }

  async findById(collection: string, id: Identifier) {
    const Model = this.getModel(collection);
    if (!Model) return null;
    return await Model.findOne({ id: parseInt(String(id), 10) });
  }

  async findOne(collection: string, query: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return null;
    return await Model.findOne(query);
  }

  async findMany(collection: string, query: AnyRecord = {}) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    return await Model.find(query);
  }

  async create(collection: string, data: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Model not found: ${collection}`);

    if (!data.id) {
      data.id = await this.getNextId(collection);
    }

    delete data._id;

    const created = await Model.create(data);
    return created;
  }

  async update(collection: string, id: Identifier, data: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return null;

    const updated = await Model.findOneAndUpdate({ id: parseInt(String(id), 10) }, data, {
      new: true,
      runValidators: true,
    });
    return updated;
  }

  async delete(collection: string, id: Identifier) {
    const Model = this.getModel(collection);
    if (!Model) return false;

    const deleted = await Model.findOneAndDelete({ id: parseInt(String(id), 10) });
    return !!deleted;
  }

  // ==================== UTILITY METHODS ====================

  async insertMany(collection: string, records: AnyRecord[]) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Model not found: ${collection}`);

    // Auto-generate numeric IDs for records that don't have one
    let nextId = await this.getNextId(collection);
    const prepared = records.map((record) => {
      const item = { ...record };
      delete item._id;
      if (!item.id) {
        item.id = nextId++;
      }
      return item;
    });

    const created = await Model.insertMany(prepared);
    return created;
  }

  async deleteMany(collection: string, query: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return 0;

    const result = await Model.deleteMany(query);
    return result.deletedCount;
  }

  async exists(collection: string, query: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return false;

    const doc = await Model.exists(query);
    return !!doc;
  }

  async distinct(collection: string, field: string, query: AnyRecord = {}) {
    const Model = this.getModel(collection);
    if (!Model) return [];

    return await Model.distinct(field, query);
  }

  async count(collection: string, query: AnyRecord = {}) {
    const Model = this.getModel(collection);
    if (!Model) return 0;

    return await Model.countDocuments(query);
  }

  async getNextId(collection: string) {
    const Model = this.getModel(collection);
    if (!Model) return 1;

    try {
      const lastItem = await Model.findOne().sort({ id: -1 }).select('id').lean();
      return lastItem ? lastItem.id + 1 : 1;
    } catch (error) {
      return 1;
    }
  }

  async getSlice(collection: string, start: number, end: number) {
    const Model = this.getModel(collection);
    if (!Model) return { data: [], total: 0 };

    const [items, total] = await Promise.all([
      Model.find()
        .skip(start)
        .limit(end - start),
      Model.countDocuments(),
    ]);
    return { data: items, total };
  }

  saveData() {
    return true;
  }
}

export default MongoConnect;
