const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

class MongoAdapter {
  constructor() {
    this.models = {};
    // Relationships definition
    // foreignField MUST BE 'id' (the numeric public ID), not '_id' (internal ObjectId)
    this.relations = {
      users: {
        notifications: { ref: 'notifications', localField: 'id', foreignField: 'user_id' }
      },
      notifications: {
        user: { ref: 'users', localField: 'user_id', foreignField: 'id', justOne: true }
      }
    };

    this.initConnection();
    this.loadSchemasAsModels();
  }

  async initConnection() {
    if (mongoose.connection.readyState === 0) {
      try {
        await mongoose.connect(process.env.DATABASE_URL);
        console.log('🔌 MongoDB Adapter Connected (Dual-ID Mode)');
      } catch (error) {
        console.error('❌ MongoDB Connection Error:', error);
        throw error;
      }
    }
  }

  loadSchemasAsModels() {
    const schemasDir = path.join(__dirname, '../schemas');

    if (!fs.existsSync(schemasDir)) {
      console.error('❌ Schemas directory not found:', schemasDir);
      return;
    }

    const files = fs.readdirSync(schemasDir);

    const modelMapping = {
      'user.schema.js': 'users',
      'notification.schema.js': 'notifications'
    };

    files.forEach(file => {
      if (file === 'index.js') return;

      const entityName = modelMapping[file];

      if (!entityName) {
        return;
      }

      try {
        const schemaDef = require(path.join(schemasDir, file));

        if (!schemaDef || typeof schemaDef !== 'object') {
          return;
        }

        const mongooseFields = {};

        // Explicitly add 'id' field for compatibility
        mongooseFields.id = { type: Number, unique: true, index: true };

        for (const [key, val] of Object.entries(schemaDef)) {
          if (key === 'custom') continue;

          let type = String;
          if (val.type === 'number') type = Number;
          if (val.type === 'boolean') type = Boolean;
          if (val.type === 'date') type = Date;
          if (val.type === 'array') type = Array;
          if (val.type === 'object') type = mongoose.Schema.Types.Mixed; // Store objects as Mixed

          if (val.foreignKey) type = Number; // Foreign keys are numbers

          mongooseFields[key] = {
            type: type,
            required: val.required || false,
            default: val.default,
            unique: val.unique || false
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
              transform: function (doc, ret) {
                delete ret._id; // Hide internal ObjectId
                delete ret.__v;
              }
            },
            toObject: { virtuals: true },
            id: false // Disable Mongoose's default virtual 'id' since we have a real one
          });

          // Setup Virtuals for populate
          const rels = this.relations[entityName];
          if (rels) {
            for (const [field, config] of Object.entries(rels)) {
              if (!mongooseFields[field]) {
                schema.virtual(field, {
                  ref: config.ref,
                  localField: config.localField,
                  foreignField: config.foreignField,
                  justOne: config.justOne || false
                });
              }
            }
          }

          this.models[entityName] = mongoose.model(entityName, schema);
          console.log(`✅ Model created: ${entityName}`);
        } else {
          this.models[entityName] = mongoose.models[entityName];
        }
      } catch (error) {
        console.error(`❌ Error loading schema ${file}:`, error.message);
      }
    });

    console.log(`📦 Total models loaded: ${Object.keys(this.models).length}`);
  }

  getModel(collection) {
    return this.models[collection];
  }

  // ==================== FIND ALL ADVANCED ====================
  async findAllAdvanced(collection, options = {}) {
    const Model = this.getModel(collection);
    if (!Model) {
      throw new Error(`Model not found for collection: ${collection}`);
    }

    const query = {};

    if (options.q) {
      query['$or'] = [
        { name: { $regex: options.q, $options: 'i' } },
        { title: { $regex: options.q, $options: 'i' } },
        { description: { $regex: options.q, $options: 'i' } },
        { comment: { $regex: options.q, $options: 'i' } }
      ];
    }

    if (options.filter) {
      for (const [key, val] of Object.entries(options.filter)) {
        if (key.endsWith('_gte')) {
          const field = key.replace('_gte', '');
          query[field] = { ...query[field], $gte: Number(val) };
        } else if (key.endsWith('_lte')) {
          const field = key.replace('_lte', '');
          query[field] = { ...query[field], $lte: Number(val) };
        } else if (key.endsWith('_gt')) {
          const field = key.replace('_gt', '');
          query[field] = { ...query[field], $gt: Number(val) };
        } else if (key.endsWith('_lt')) {
          const field = key.replace('_lt', '');
          query[field] = { ...query[field], $lt: Number(val) };
        } else if (key.endsWith('_ne')) {
          const field = key.replace('_ne', '');
          query[field] = { $ne: val };
        } else if (key.endsWith('_like')) {
          const field = key.replace('_like', '');
          query[field] = { $regex: val, $options: 'i' };
        } else if (key.endsWith('_in')) {
          const field = key.replace('_in', '');
          const values = Array.isArray(val) ? val : val.split(',');
          query[field] = { $in: values };
        } else {
          query[key] = val;
        }
      }
    }

    const page = parseInt(options.page) || 1;
    const limit = parseInt(options.limit) || 10;
    const skip = (page - 1) * limit;

    let queryBuilder = Model.find(query);

    if (options.sort) {
      const sortFields = options.sort.split(',');
      const orders = options.order ? options.order.split(',') : [];
      const sortObj = {};

      sortFields.forEach((field, index) => {
        const order = orders[index] === 'desc' ? -1 : 1;
        sortObj[field] = order;
      });

      queryBuilder = queryBuilder.sort(sortObj);
    } else {
      queryBuilder = queryBuilder.sort({ createdAt: -1 });
    }

    // Populate
    const populateFields = [];
    if (options.embed) populateFields.push(...options.embed.split(','));
    if (options.expand) populateFields.push(...options.expand.split(','));

    populateFields.forEach(field => {
      try {
        queryBuilder = queryBuilder.populate(field);
      } catch (e) {
        console.warn(`⚠️ Cannot populate ${field}`);
      }
    });

    const data = await queryBuilder.skip(skip).limit(limit).exec(); // Use exec() to get Mongoose Documents
    const total = await Model.countDocuments(query);

    return {
      success: true,
      data: data, // toJSON transform will auto-hide _id
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    };
  }

  // ==================== CRUD METHODS ====================
  // Note: All query by public 'id' (Number), not '_id' (ObjectId)

  async findAll(collection) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    return await Model.find();
  }

  async findById(collection, id) {
    const Model = this.getModel(collection);
    if (!Model) return null;
    return await Model.findOne({ id: parseInt(id) });
  }

  async findOne(collection, query) {
    const Model = this.getModel(collection);
    if (!Model) return null;
    return await Model.findOne(query);
  }

  async findMany(collection, query) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    return await Model.find(query);
  }

  async create(collection, data) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Model not found: ${collection}`);

    // Auto-generate numeric ID if not present
    if (!data.id) {
      data.id = await this.getNextId(collection);
    }

    // Safety: ensure no _id is passed, allowing Mongo to generate it
    delete data._id;

    const created = await Model.create(data);
    return created;
  }

  async update(collection, id, data) {
    const Model = this.getModel(collection);
    if (!Model) return null;

    // FIND by 'id' and update
    const updated = await Model.findOneAndUpdate(
      { id: parseInt(id) },
      data,
      { new: true, runValidators: true }
    );
    return updated;
  }

  async delete(collection, id) {
    const Model = this.getModel(collection);
    if (!Model) return false;

    // FIND by 'id' and delete
    const deleted = await Model.findOneAndDelete({ id: parseInt(id) });
    return !!deleted;
  }

  async getNextId(collection) {
    const Model = this.getModel(collection);
    if (!Model) return 1;

    try {
      // Find max 'id'
      const lastItem = await Model.findOne().sort({ id: -1 }).select('id').lean();
      return lastItem ? lastItem.id + 1 : 1;
    } catch (error) {
      return 1;
    }
  }

  async getSlice(collection, start, end) {
    const Model = this.getModel(collection);
    if (!Model) return { data: [], total: 0 };
    const items = await Model.find().skip(start).limit(end - start);
    const total = await Model.countDocuments();
    return { data: items, total };
  }

  saveData() { return true; }
}

module.exports = new MongoAdapter();