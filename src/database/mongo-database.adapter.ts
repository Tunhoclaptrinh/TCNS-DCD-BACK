import mongoose from 'mongoose';
import schemas from '@schemas';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { DatabaseAdapter, QueryOptions } from '@app-types/database';
import type { SchemaDefinition, SchemaRule } from '@app-types/schema';
import { camelizeObjectKeys, splitKeyBySuffix, toCamelCase } from '@utils/case';
import { QUERY_OPERATOR_SUFFIXES } from '@utils/query-helpers';
import { logger } from '@utils/logger';

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
        notifications: { ref: 'notifications', localField: 'id', foreignField: 'userId' },
        notificationSettings: { ref: 'notification_settings', localField: 'id', foreignField: 'userId' },
        files: { ref: 'files', localField: 'id', foreignField: 'uploadedBy' },
        generation: { ref: 'generations', localField: 'generationId', foreignField: 'id', justOne: true },
        roles: { ref: 'roles', localField: 'roleIds', foreignField: 'id', justOne: false },
      },
      files: {
        uploader: { ref: 'users', localField: 'uploadedBy', foreignField: 'id', justOne: true },
      },
      notifications: {
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
      },
      notification_settings: {
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
      },
      reward_penalties: {
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
        creator: { ref: 'users', localField: 'createdBy', foreignField: 'id', justOne: true },
        violation: { ref: 'duty_violations', localField: 'violationId', foreignField: 'id', justOne: true },
      },
      meetings: {
        creator: { ref: 'users', localField: 'createdBy', foreignField: 'id', justOne: true },
        updater: { ref: 'users', localField: 'updatedBy', foreignField: 'id', justOne: true },
      },
      bonus_campaigns: {
        creator: { ref: 'users', localField: 'createdBy', foreignField: 'id', justOne: true },
        updater: { ref: 'users', localField: 'updatedBy', foreignField: 'id', justOne: true },
        semester: { ref: 'semesters', localField: 'semesterId', foreignField: 'id', justOne: true },
      },
      duty_swap_requests: {
        requester: { ref: 'users', localField: 'requesterId', foreignField: 'id', justOne: true },
        approver: { ref: 'users', localField: 'approvedBy', foreignField: 'id', justOne: true },
        fromSlot: { ref: 'duty_slots', localField: 'fromSlotId', foreignField: 'id', justOne: true },
        toSlot: { ref: 'duty_slots', localField: 'toSlotId', foreignField: 'id', justOne: true },
      },
      duty_kips: {
        shift: { ref: 'duty_shifts', localField: 'shiftId', foreignField: 'id', justOne: true },
      },
      duty_slots: {
        kip: { ref: 'duty_kips', localField: 'kipId', foreignField: 'id', justOne: true },
        shift: { ref: 'duty_shifts', localField: 'shiftId', foreignField: 'id', justOne: true },
        creator: { ref: 'users', localField: 'createdBy', foreignField: 'id', justOne: true },
        assignedUsers: { ref: 'users', localField: 'assignedUserIds', foreignField: 'id', justOne: false },
        attendedUsers: { ref: 'users', localField: 'attendedUserIds', foreignField: 'id', justOne: false },
      },
      duty_leave_requests: {
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
        slot: { ref: 'duty_slots', localField: 'slotId', foreignField: 'id', justOne: true },
        approver: { ref: 'users', localField: 'approvedBy', foreignField: 'id', justOne: true },
      },
      duty_logs: {
        slot: { ref: 'duty_slots', localField: 'slotId', foreignField: 'id', justOne: true },
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
        performer: { ref: 'users', localField: 'performerId', foreignField: 'id', justOne: true },
      },
      duty_violations: {
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
        slot: { ref: 'duty_slots', localField: 'slotId', foreignField: 'id', justOne: true },
        creator: { ref: 'users', localField: 'createdBy', foreignField: 'id', justOne: true },
        penalty: { ref: 'reward_penalties', localField: 'penaltyId', foreignField: 'id', justOne: true },
      },
      duty_template_assignments: {
        template: { ref: 'duty_templates', localField: 'templateId', foreignField: 'id', justOne: true },
      },
      audit_logs: {
        user: { ref: 'users', localField: 'userId', foreignField: 'id', justOne: true },
      },
    };
  }

  castQueryValue(val: any) {
    if (val === null || val === undefined) return val;
    if (val instanceof Date) return val;

    const text = String(val).trim();
    if (text === '') return text;

    if (text === 'true') return true;
    if (text === 'false') return false;

    // Cast numeric strings to numbers
    if (/^-?\d+(\.\d+)?$/.test(text)) {
      return Number(text);
    }

    // Only cast strings that look like explicit ISO dates (YYYY-MM-DD or full ISO 8601)
    // This avoids false positives on random strings that Date.parse() happens to accept
    if (/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(text)) {
      const maybeDate = new Date(text);
      if (!Number.isNaN(maybeDate.getTime())) {
        return maybeDate;
      }
    }

    return text;
  }

  // ==================== CONNECTION ====================

  async initConnection() {
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(process.env.DATABASE_URL);
      } catch (error) {
        logger.error('MongoDB connection error', 'DB', error);
        throw error;
      }
    }
  }

  // ==================== SCHEMA LOADING ====================

  private toMongooseFields(schemaDef: SchemaDefinition): Record<string, any> {
    const mongooseFields: Record<string, any> = {};

    for (const [key, val] of Object.entries(schemaDef) as Array<[string, SchemaRule]>) {
      if (key === 'custom') continue;

      let type: any = String;
      if (val.type === 'number') type = Number;
      if (val.type === 'boolean') type = Boolean;
      if (val.type === 'date') type = Date;
      if (val.type === 'email') type = String;

      if (val.type === 'array') {
        if (val.items) {
          const itemFields = this.toMongooseFields({ item: val.items });
          type = [itemFields.item];
        } else {
          type = Array;
        }
      }

      if (val.type === 'object') {
        if (val.properties) {
          type = this.toMongooseFields(val.properties);
        } else {
          type = mongoose.Schema.Types.Mixed;
        }
      }

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

    return mongooseFields;
  }

  async loadSchemasAsModels() {
    for (const [entityName, schemaDef] of Object.entries(schemas) as Array<[string, SchemaDefinition]>) {
      const mongooseFields = this.toMongooseFields(schemaDef);

      // Auto-increment numeric id field
      mongooseFields.id = { type: Number, unique: true, index: true };

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
      } else {
        this.models[entityName] = mongoose.models[entityName];
      }
    }
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
      Object.assign(query, this.buildMongoQuery(options.filter));
    }

    const page = parseInt(String(options.page || options._page || 1), 10) || 1;
    const limit = parseInt(String(options.limit || options._limit || 10), 10) || 10;
    const skip = (page - 1) * limit;

    let queryBuilder = Model.find(query);

    // Sort
    if (options.sort) {
      const sortFields = options.sort.split(',');
      const orders = options.order ? options.order.split(',') : [];
      const sortObj: Record<string, number> = {};
      sortFields.forEach((field, index) => {
        sortObj[toCamelCase(field)] = orders[index] === 'desc' ? -1 : 1;
      });
      queryBuilder = queryBuilder.sort(sortObj);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 });
    }

    // Populate
    const populateFields: string[] = [];
    if (options.embed) populateFields.push(...options.embed.split(',').map((field) => toCamelCase(field)));
    if (options.expand) populateFields.push(...options.expand.split(',').map((field) => toCamelCase(field)));

    for (const field of populateFields) {
      try {
        queryBuilder = queryBuilder.populate(field);
      } catch (e) {
        logger.warn(`Cannot populate ${field}`, 'DB');
      }
    }

    const [data, total] = await Promise.all([
      queryBuilder.skip(skip).limit(limit).lean().exec(),
      Model.countDocuments(query),
    ]);

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

  async findById(collection: string, id: Identifier) {
    const Model = this.getModel(collection);
    if (!Model) return null;

    const query: any = {};
    if (/^\d+$/.test(String(id))) {
      query.id = parseInt(String(id), 10);
    } else {
      query._id = id;
    }

    const doc = await Model.findOne(query).lean();
    return this.mapId(doc);
  }

  // Utility to convert our suffix-based query to MongoDB query
  private mapId(doc: any) {
    if (!doc) return doc;
    const result = { ...doc };
    if (result._id && !result.id) {
      result.id = result._id.toString();
    }
    return result;
  }

  private buildMongoQuery(query: AnyRecord) {
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Building query for: ${JSON.stringify(query)}`, 'MongoAdapter');
    }
    const mongoQuery: AnyRecord = {};
    const normalized = query;

    for (const [key, val] of Object.entries(normalized)) {
      // Support for $or, $and, $nor
      if (['$or', '$and', '$nor'].includes(key) && Array.isArray(val)) {
        mongoQuery[key] = val.map((item) => (typeof item === 'object' ? this.buildMongoQuery(item) : item));
        continue;
      }

      // If it's already a Mongo operator object, pass it through
      if (val && typeof val === 'object' && !Array.isArray(val) && Object.keys(val).some((k) => k.startsWith('$'))) {
        mongoQuery[key] = val;
        continue;
      }

      const { field: rawField, suffix } = splitKeyBySuffix(key, QUERY_OPERATOR_SUFFIXES);
      const field = toCamelCase(rawField);

      if (suffix === '_gte') {
        mongoQuery[field] = { ...mongoQuery[field], $gte: this.castQueryValue(val) };
      } else if (suffix === '_lte') {
        mongoQuery[field] = { ...mongoQuery[field], $lte: this.castQueryValue(val) };
      } else if (suffix === '_gt') {
        mongoQuery[field] = { ...mongoQuery[field], $gt: this.castQueryValue(val) };
      } else if (suffix === '_lt') {
        mongoQuery[field] = { ...mongoQuery[field], $lt: this.castQueryValue(val) };
      } else if (suffix === '_ne') {
        mongoQuery[field] = { $ne: this.castQueryValue(val) };
      } else if (suffix === '_like') {
        mongoQuery[field] = { $regex: String(val) };
      } else if (suffix === '_ilike') {
        mongoQuery[field] = { $regex: String(val), $options: 'i' };
      } else if (suffix === '_not_like') {
        mongoQuery[field] = { $not: { $regex: String(val), $options: 'i' } };
      } else if (suffix === '_in') {
        const values = Array.isArray(val) ? val : String(val).split(',');
        mongoQuery[field] = { $in: values.map((item) => this.castQueryValue(item)) };
      } else if (suffix === '_nin') {
        const values = Array.isArray(val) ? val : String(val).split(',');
        mongoQuery[field] = { $nin: values.map((item) => this.castQueryValue(item)) };
      } else {
        // Special case for MongoDB internal _id
        if (key === '_id') {
          mongoQuery['_id'] = val;
        } else {
          mongoQuery[field] = this.castQueryValue(val);
        }
      }
    }
    if (process.env.NODE_ENV === 'development') {
      logger.debug(`Final Mongo Query: ${JSON.stringify(mongoQuery)}`, 'MongoAdapter');
    }
    return mongoQuery;
  }

  async findOne(collection: string, query: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return null;
    const doc = await Model.findOne(this.buildMongoQuery(query)).lean();
    return this.mapId(doc);
  }

  async findMany(collection: string, query: AnyRecord = {}) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    const docs = await Model.find(this.buildMongoQuery(query)).lean();
    return docs.map((d) => this.mapId(d));
  }

  async findAll(collection: string) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    const docs = await Model.find({}).lean();
    return docs.map((d) => this.mapId(d));
  }

  async create(collection: string, data: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Model not found: ${collection}`);

    const normalizedData = camelizeObjectKeys(data);

    if (!normalizedData.id) {
      normalizedData.id = await this.getNextId(collection);
    }

    delete normalizedData._id;

    const created = await Model.create(normalizedData);
    return created;
  }

  async update(collection: string, id: Identifier, data: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return null;

    const query: any = {};
    if (/^\d+$/.test(String(id))) {
      query.id = parseInt(String(id), 10);
    } else {
      query._id = id;
    }

    const updateData = camelizeObjectKeys(data);
    delete updateData.id;
    delete updateData._id;

    const updated = await Model.findOneAndUpdate(query, updateData, {
      new: true,
      runValidators: true,
    });
    return updated;
  }

  async updateMany(collection: string, query: AnyRecord, data: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return 0;

    const mongooseQuery = this.buildMongoQuery(query);
    const updateData = camelizeObjectKeys(data);
    delete updateData.id;
    delete updateData._id;

    const result = await Model.updateMany(mongooseQuery, updateData);
    return result.modifiedCount;
  }

  async delete(collection: string, id: Identifier) {
    const Model = this.getModel(collection);
    if (!Model) return false;

    const query: any = {};
    if (/^\d+$/.test(String(id))) {
      query.id = parseInt(String(id), 10);
    } else {
      query._id = id;
    }

    const deleted = await Model.findOneAndDelete(query);
    return !!deleted;
  }

  private counterLocks: Record<string, Promise<void>> = {};

  async ensureCounter(collection: string, Model: any, CounterModel: any) {
    if (this.counterLocks[collection]) {
      await this.counterLocks[collection];
      return;
    }

    let resolveLock!: () => void;
    this.counterLocks[collection] = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });

    try {
      const existing = await CounterModel.findOne({ _id: collection }).lean();
      const lastItem = await Model.findOne().sort({ id: -1 }).select('id').lean();
      const maxVal = lastItem ? Number(lastItem.id) : 0;

      if (!existing || (existing as any).seq < maxVal) {
        await CounterModel.updateOne({ _id: collection }, { seq: maxVal }, { upsert: true });
      }
    } catch (err) {
      logger.error(`Failed to initialize counter for ${collection}`, 'DB', err);
    } finally {
      resolveLock();
    }
  }

  async getNextId(collection: string, reserveCount: number = 1) {
    const Model = this.getModel(collection);
    if (!Model) return 1;

    try {
      if (!mongoose.models['_counters']) {
        const counterSchema = new mongoose.Schema({ _id: String, seq: Number }, { versionKey: false });
        mongoose.model('_counters', counterSchema);
      }
      const CounterModel = mongoose.model('_counters');

      // 1. Ensure counter is seeded safely via Memory Lock
      await this.ensureCounter(collection, Model, CounterModel);

      // 2. Safely atomic increment
      const counter = await CounterModel.findOneAndUpdate(
        { _id: collection },
        { $inc: { seq: reserveCount } },
        { new: true, upsert: true },
      );

      if (!counter) {
        throw new Error(`Failed to generate or increment counter for ${collection}`);
      }

      return (counter as any).seq - reserveCount + 1;
    } catch (error) {
      logger.error(`Auto-increment atomic error for ${collection}`, 'DB', error);
      const lastItem = await Model.findOne().sort({ id: -1 }).select('id').lean();
      return lastItem ? lastItem.id + 1 : 1;
    }
  }

  async insertMany(collection: string, records: AnyRecord[]) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Model not found: ${collection}`);

    // Filter items that actually need ID generation
    const itemsWithoutId = records.filter((r) => !r.id && !r._id);
    let nextId = 1;

    // Atomically reserve EXACTLY the amount of IDs we need
    if (itemsWithoutId.length > 0) {
      nextId = await this.getNextId(collection, itemsWithoutId.length);
    }

    const prepared = records.map((record) => {
      const item = camelizeObjectKeys(record);
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

    const mongooseQuery = this.buildMongoQuery(query);
    const result = await Model.deleteMany(mongooseQuery);
    return result.deletedCount;
  }

  async count(collection: string, query: AnyRecord = {}) {
    const Model = this.getModel(collection);
    if (!Model) return 0;
    const mongooseQuery = this.buildMongoQuery(query);
    return await Model.countDocuments(mongooseQuery);
  }

  async exists(collection: string, query: AnyRecord) {
    const Model = this.getModel(collection);
    if (!Model) return false;

    const mongooseQuery = this.buildMongoQuery(query);
    const doc = await Model.exists(mongooseQuery);
    return !!doc;
  }

  async distinct(collection: string, field: string, query: AnyRecord = {}) {
    const Model = this.getModel(collection);
    if (!Model) return [];

    return await Model.distinct(toCamelCase(field), camelizeObjectKeys(query));
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

// ==================== ADAPTER SELECTION ====================

let dbInstance: DatabaseAdapter | null;

async function initDatabase() {
  if (dbInstance) return dbInstance;

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Cannot connect to MongoDB.');
  }

  const adapter = new MongoConnect();
  await adapter.initConnection();
  await adapter.loadSchemasAsModels();
  dbInstance = adapter;

  return dbInstance;
}

const dbProxy = new Proxy({} as DatabaseAdapter, {
  get(_target, prop: keyof DatabaseAdapter) {
    if (!dbInstance) {
      throw new Error(
        `Database is not initialized. Call initDatabase() first. Attempted to access: ${prop.toString()}`,
      );
    }
    const value = dbInstance[prop];
    return typeof value === 'function' ? value.bind(dbInstance) : value;
  },
});

export { initDatabase };
export default dbProxy;
