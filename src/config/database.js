import fs from 'fs';
import path from 'path';

const DB_FILE = path.join(__dirname, '../database/db.json');

class JsonAdapter {
  constructor() {
    this.data = this.loadData();
    console.log('📂 JSON Database Adapter Loaded');
  }

  loadData() {
    try {
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error('Error loading database:', error);
      return this.getDefaultData();
    }
  }

  saveData() {
    try {
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving database:', error);
      return false;
    }
  }

  getDefaultData() {
    return {
      users: [],
      notifications: [],
      notification_settings: [],
      duty_slots: [],
      duty_swap_requests: [],
      reward_penalties: [],
    };
  }

  // ==================== RELATION HELPERS ====================

  getRelatedCollection(collection, relation) {
    const relationMap = {
      users: {
        notifications: 'notifications',
      },
    };
    return relationMap[collection]?.[relation];
  }

  getForeignKey(collection, relation) {
    const keyMap = {
      users: {
        notifications: 'user_id',
      },
    };
    return keyMap[collection]?.[relation];
  }

  // ==================== ENHANCED QUERY METHODS ====================

  findAllAdvanced(collection, options = {}) {
    let items = [...(this.data[collection] || [])];

    if (options.filter) {
      items = this.applyFilters(items, options.filter);
    }

    if (options.q) {
      items = this.applyFullTextSearch(items, options.q);
    }

    if (options.embed || options.expand) {
      items = this.applyRelations(items, collection, options);
    }

    if (options.sort) {
      items = this.applySorting(items, options.sort, options.order);
    }

    const pagination = this.applyPagination(items, options.page, options.limit);

    return {
      data: pagination.data,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: pagination.total,
        totalPages: pagination.totalPages,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev,
      },
    };
  }

  applyFilters(items, filters) {
    return items.filter((item) => {
      return Object.keys(filters).every((key) => {
        if (key.endsWith('_gte')) {
          const field = key.replace('_gte', '');
          return item[field] >= filters[key];
        }
        if (key.endsWith('_lte')) {
          const field = key.replace('_lte', '');
          return item[field] <= filters[key];
        }
        if (key.endsWith('_gt')) {
          const field = key.replace('_gt', '');
          return item[field] > filters[key];
        }
        if (key.endsWith('_lt')) {
          const field = key.replace('_lt', '');
          return item[field] < filters[key];
        }
        if (key.endsWith('_ne')) {
          const field = key.replace('_ne', '');
          return item[field] !== filters[key];
        }
        if (key.endsWith('_like') || key.endsWith('_ilike')) {
          const field = key.replace('_like', '').replace('_ilike', '');
          // Escape special regex characters to prevent ReDoS
          const escaped = String(filters[key]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(escaped, 'i').test(item[field]);
        }
        if (key.endsWith('_not_like')) {
          const field = key.replace('_not_like', '');
          const escaped = String(filters[key]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return !new RegExp(escaped, 'i').test(item[field]);
        }
        if (key.endsWith('_in')) {
          const field = key.replace('_in', '');
          const values = Array.isArray(filters[key]) ? filters[key] : String(filters[key]).split(',');
          return values.includes(String(item[field]));
        }
        if (key.endsWith('_nin')) {
          const field = key.replace('_nin', '');
          const values = Array.isArray(filters[key]) ? filters[key] : String(filters[key]).split(',');
          return !values.includes(String(item[field]));
        }

        // Strict equality — convert types to match
        const filterVal = filters[key];
        const itemVal = item[key];
        if (typeof itemVal === 'number') return itemVal === Number(filterVal);
        if (typeof itemVal === 'boolean') return itemVal === (filterVal === true || filterVal === 'true');
        return itemVal === filterVal;
      });
    });
  }

  applyFullTextSearch(items, query) {
    const searchTerm = query.toLowerCase();
    return items.filter((item) => {
      return Object.values(item).some((value) => {
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchTerm);
        }
        return false;
      });
    });
  }

  applyRelations(items, collection, options) {
    return items.map((item) => {
      const enriched = { ...item };

      if (options.embed) {
        const relations = options.embed.split(',');
        relations.forEach((relation) => {
          const relatedCollection = this.getRelatedCollection(collection, relation);
          if (relatedCollection) {
            const foreignKey = this.getForeignKey(collection, relation);
            enriched[relation] = this.data[relatedCollection]?.filter((r) => r[foreignKey] === item.id) || [];
          }
        });
      }

      if (options.expand) {
        const relations = options.expand.split(',');
        relations.forEach((relation) => {
          // Check both camelCase and snake_case foreign key formats
          const foreignKey = item[`${relation}Id`] !== undefined ? `${relation}Id` : `${relation}_id`;
          if (item[foreignKey]) {
            const targetCollection = relation + 's';
            enriched[relation] = this.findById(targetCollection, item[foreignKey]);
          }
        });
      }

      return enriched;
    });
  }

  applySorting(items, sortField, order = 'asc') {
    const fields = sortField.split(',');

    return items.sort((a, b) => {
      for (const field of fields) {
        const aVal = a[field];
        const bVal = b[field];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          const comparison = aVal.localeCompare(bVal, 'vi');
          return order === 'asc' ? comparison : -comparison;
        }

        if (aVal < bVal) return order === 'asc' ? -1 : 1;
        if (aVal > bVal) return order === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  applyPagination(items, page = 1, limit = 10) {
    const total = items.length;
    const currentPage = Math.max(1, Number(page) || 1);
    const itemsPerPage = Math.max(1, Math.min(Number(limit) || 10, 1000));
    const totalPages = Math.ceil(total / itemsPerPage);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    return {
      data: items.slice(startIndex, endIndex),
      page: currentPage,
      limit: itemsPerPage,
      total,
      totalPages,
      hasNext: currentPage < totalPages,
      hasPrev: currentPage > 1,
    };
  }

  getSlice(collection, start, end) {
    const items = this.data[collection] || [];
    return {
      data: items.slice(start, end),
      total: items.length,
    };
  }

  // ==================== CRUD METHODS ====================

  findAll(collection) {
    return this.data[collection] || [];
  }

  findById(collection, id) {
    return this.data[collection]?.find((item) => item.id === parseInt(id));
  }

  findOne(collection, query) {
    return this.data[collection]?.find((item) => {
      return Object.keys(query).every((key) => item[key] === query[key]);
    });
  }

  findMany(collection, query) {
    if (!query || Object.keys(query).length === 0) {
      return this.data[collection] || [];
    }
    return (
      this.data[collection]?.filter((item) => {
        return Object.keys(query).every((key) => item[key] === query[key]);
      }) || []
    );
  }

  create(collection, data) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    const id = this.getNextId(collection);
    const newItem = { id, ...data };
    this.data[collection].push(newItem);
    this.saveData();
    return newItem;
  }

  update(collection, id, data) {
    if (!this.data[collection]) return null;
    const index = this.data[collection].findIndex((item) => item.id === parseInt(id, 10));
    if (index === -1) return null;

    this.data[collection][index] = {
      ...this.data[collection][index],
      ...data,
      id: parseInt(id, 10),
    };
    this.saveData();
    return this.data[collection][index];
  }

  delete(collection, id) {
    if (!this.data[collection]) return false;
    const index = this.data[collection].findIndex((item) => item.id === parseInt(id, 10));
    if (index === -1) return false;

    this.data[collection].splice(index, 1);
    this.saveData();
    return true;
  }

  getNextId(collection) {
    const items = this.data[collection] || [];
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.id)) + 1;
  }

  // ==================== UTILITY METHODS ====================

  exists(collection, query) {
    if (!this.data[collection]) return false;
    return this.data[collection].some((item) => {
      return Object.keys(query).every((key) => item[key] === query[key]);
    });
  }

  distinct(collection, field) {
    if (!this.data[collection]) return [];
    const values = this.data[collection].map((item) => item[field]).filter((v) => v !== undefined && v !== null);
    return [...new Set(values)];
  }

  count(collection, query = null) {
    if (!this.data[collection]) return 0;
    if (!query || Object.keys(query).length === 0) {
      return this.data[collection].length;
    }
    return this.data[collection].filter((item) => {
      return Object.keys(query).every((key) => item[key] === query[key]);
    }).length;
  }

  insertMany(collection, records) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }

    const created = records.map((data) => {
      const id = this.getNextId(collection);
      const newItem = { id, ...data };
      this.data[collection].push(newItem);
      return newItem;
    });

    this.saveData();
    return created;
  }

  deleteMany(collection, ids) {
    if (!this.data[collection]) return 0;

    const parsedIds = ids.map((id) => parseInt(id, 10));
    const before = this.data[collection].length;
    this.data[collection] = this.data[collection].filter((item) => !parsedIds.includes(item.id));
    const deleted = before - this.data[collection].length;

    if (deleted > 0) this.saveData();
    return deleted;
  }
}

// ==================== ADAPTER SELECTION ====================

let dbInstance;

const dbConnection = (process.env.DB_CONNECTION || 'json').toLowerCase();

async function initDatabase() {
  if (dbInstance) return dbInstance;

  if (dbConnection === 'mongodb' || dbConnection === 'mongo') {
    if (!process.env.DATABASE_URL) {
      console.warn('⚠️ DB_CONNECTION=mongodb but DATABASE_URL is missing. Falling back to JSON.');
      dbInstance = new JsonAdapter();
    } else {
      const { default: MongoConnect } = await import('@config/mongo-connect');
      const adapter = new MongoConnect();
      await adapter.initConnection();
      await adapter.loadSchemasAsModels();
      dbInstance = adapter;
    }
  } else {
    dbInstance = new JsonAdapter();
  }

  return dbInstance;
}

// Init ngay cho JSON adapter (sync), MongoDB sẽ init khi gọi initDatabase()
if (dbConnection !== 'mongodb' && dbConnection !== 'mongo') {
  dbInstance = new JsonAdapter();
}

const dbProxy = new Proxy(
  {},
  {
    get(target, prop) {
      if (!dbInstance) {
        throw new Error(
          `Database is not initialized. Call initDatabase() first. Attempted to access: ${prop.toString()}`,
        );
      }
      const value = dbInstance[prop];
      return typeof value === 'function' ? value.bind(dbInstance) : value;
    },
  },
);

export { initDatabase };
export default dbProxy;
