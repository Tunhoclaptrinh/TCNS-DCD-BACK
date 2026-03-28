import fs from 'fs';
import path from 'path';
import type { AnyRecord, Identifier } from '@app-types/common';
import type { CollectionStore, DatabaseAdapter, FindAllResult, QueryOptions } from '@app-types/database';
import { camelizeObjectKeys, splitKeyBySuffix, toCamelCase } from '@utils/case';

const DATA_DIR = path.resolve(process.cwd(), 'src/database');
const DB_FILE = process.env.DB_FILE || path.join(DATA_DIR, 'db.json');
const FILTER_SUFFIXES = ['_not_like', '_ilike', '_like', '_gte', '_lte', '_gt', '_lt', '_ne', '_in', '_nin'];

const RELATION_MAP = {
  users: {
    notifications: { collection: 'notifications', foreignField: 'userId' },
    notificationSettings: { collection: 'notification_settings', foreignField: 'userId' },
    files: { collection: 'files', foreignField: 'uploadedBy' },
  },
  files: {
    uploader: { collection: 'users', localField: 'uploadedBy', justOne: true },
  },
  notifications: {
    user: { collection: 'users', localField: 'userId', justOne: true },
  },
  notification_settings: {
    user: { collection: 'users', localField: 'userId', justOne: true },
  },
  reward_penalties: {
    user: { collection: 'users', localField: 'userId', justOne: true },
    creator: { collection: 'users', localField: 'createdBy', justOne: true },
  },
  duty_swap_requests: {
    requester: { collection: 'users', localField: 'requesterId', justOne: true },
    targetUser: { collection: 'users', localField: 'targetUserId', justOne: true },
    approver: { collection: 'users', localField: 'approvedBy', justOne: true },
    dutySlot: { collection: 'duty_slots', localField: 'dutySlotId', justOne: true },
  },
  duty_slots: {
    kip: { collection: 'duty_kips', localField: 'kipId', justOne: true },
    shift: { collection: 'duty_shifts', localField: 'shiftId', justOne: true },
    creator: { collection: 'users', localField: 'createdBy', justOne: true },
  },
  duty_kips: {
    shift: { collection: 'duty_shifts', localField: 'shiftId', justOne: true },
  },
  duty_leave_requests: {
    user: { collection: 'users', localField: 'userId', justOne: true },
    slot: { collection: 'duty_slots', localField: 'slotId', justOne: true },
    approver: { collection: 'users', localField: 'approvedBy', justOne: true },
  },
};

class JsonAdapter implements DatabaseAdapter {
  data: CollectionStore;

  constructor() {
    this.data = this.loadData();
    console.log('📂 JSON Database Adapter Loaded');
  }

  loadData(): CollectionStore {
    try {
      const rawData = fs.readFileSync(DB_FILE, 'utf8');
      return this.normalizeStore(JSON.parse(rawData));
    } catch (error) {
      console.error('Error loading database:', error);
      return this.getDefaultData();
    }
  }

  saveData() {
    try {
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(this.data, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving database:', error);
      return false;
    }
  }

  normalizeStore(store: CollectionStore | Record<string, any>) {
    const normalized = { ...this.getDefaultData(), ...(store || {}) };

    for (const [collection, items] of Object.entries(normalized)) {
      if (!Array.isArray(items)) continue;
      normalized[collection] = items.map((item) => camelizeObjectKeys(item));
    }

    return normalized as CollectionStore;
  }

  getDefaultData(): CollectionStore {
    return {
      users: [],
      notifications: [],
      notification_settings: [],
      files: [],
      duty_slots: [],
      duty_swap_requests: [],
      reward_penalties: [],
      duty_templates: [],
      duty_shifts: [],
      duty_kips: [],
      duty_days: [],
      duty_leave_requests: [],
    };
  }

  // ==================== RELATION HELPERS ====================

  getRelationConfig(collection: string, relation: string) {
    return RELATION_MAP[collection]?.[relation];
  }

  getRelatedCollection(collection: string, relation: string) {
    return this.getRelationConfig(collection, relation)?.collection;
  }

  getForeignKey(collection: string, relation: string) {
    const relationConfig = this.getRelationConfig(collection, relation);
    return relationConfig?.foreignField || relationConfig?.localField;
  }

  // ==================== ENHANCED QUERY METHODS ====================

  findAllAdvanced(collection: string, options: QueryOptions = {}): FindAllResult {
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

  applyFilters(items: AnyRecord[], filters: AnyRecord) {
    return items.filter((item) => {
      return Object.keys(filters).every((key) => {
        const { field, suffix } = splitKeyBySuffix(key, FILTER_SUFFIXES);

        if (suffix === '_gte') {
          return item[field] >= filters[key];
        }
        if (suffix === '_lte') {
          return item[field] <= filters[key];
        }
        if (suffix === '_gt') {
          return item[field] > filters[key];
        }
        if (suffix === '_lt') {
          return item[field] < filters[key];
        }
        if (suffix === '_ne') {
          return item[field] !== filters[key];
        }
        if (suffix === '_like' || suffix === '_ilike') {
          // Escape special regex characters to prevent ReDoS
          const escaped = String(filters[key]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return new RegExp(escaped, 'i').test(item[field]);
        }
        if (suffix === '_not_like') {
          const escaped = String(filters[key]).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return !new RegExp(escaped, 'i').test(item[field]);
        }
        if (suffix === '_in') {
          const values = Array.isArray(filters[key]) ? filters[key] : String(filters[key]).split(',');
          return values.includes(String(item[field]));
        }
        if (suffix === '_nin') {
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

  applyFullTextSearch(items: AnyRecord[], query: string) {
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

  applyRelations(items: AnyRecord[], collection: string, options: QueryOptions) {
    return items.map((item) => {
      const enriched: AnyRecord = { ...item };

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
          const relationConfig = this.getRelationConfig(collection, relation);
          const foreignKey =
            relationConfig?.localField || (item[`${relation}Id`] !== undefined ? `${relation}Id` : `${relation}_id`);
          if (item[foreignKey]) {
            const targetCollection = relationConfig?.collection || relation + 's';
            enriched[relation] = this.findById(targetCollection, item[foreignKey]);
          }
        });
      }

      return enriched;
    });
  }

  applySorting(items: AnyRecord[], sortField: string, order = 'asc') {
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

  applyPagination(items: AnyRecord[], page: number | string = 1, limit: number | string = 10) {
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

  getSlice(collection: string, start: number, end: number) {
    const items = this.data[collection] || [];
    return {
      data: items.slice(start, end),
      total: items.length,
    };
  }

  // ==================== CRUD METHODS ====================

  findAll(collection: string) {
    return this.data[collection] || [];
  }

  findById(collection: string, id: Identifier) {
    return this.data[collection]?.find((item) => item.id === parseInt(String(id), 10));
  }

  findOne(collection: string, query: AnyRecord) {
    const items = this.data[collection] || [];
    const filtered = this.applyFilters(items, query);
    return filtered[0] || null;
  }

  findMany(collection: string, query: AnyRecord = {}) {
    if (!query || Object.keys(query).length === 0) {
      return this.data[collection] || [];
    }
    const items = this.data[collection] || [];
    return this.applyFilters(items, query);
  }

  create(collection: string, data: AnyRecord) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    const id = this.getNextId(collection);
    const newItem = { id, ...camelizeObjectKeys(data) };
    this.data[collection].push(newItem);
    this.saveData();
    return newItem;
  }

  update(collection: string, id: Identifier, data: AnyRecord) {
    if (!this.data[collection]) return null;
    const index = this.data[collection].findIndex((item) => item.id === parseInt(String(id), 10));
    if (index === -1) return null;

    this.data[collection][index] = {
      ...this.data[collection][index],
      ...camelizeObjectKeys(data),
      id: parseInt(String(id), 10),
    };
    this.saveData();
    return this.data[collection][index];
  }

  delete(collection: string, id: Identifier) {
    if (!this.data[collection]) return false;
    const index = this.data[collection].findIndex((item) => item.id === parseInt(String(id), 10));
    if (index === -1) return false;

    this.data[collection].splice(index, 1);
    this.saveData();
    return true;
  }

  getNextId(collection: string) {
    const items = this.data[collection] || [];
    if (items.length === 0) return 1;
    return Math.max(...items.map((item) => item.id)) + 1;
  }

  // ==================== UTILITY METHODS ====================

  exists(collection: string, query: AnyRecord) {
    const normalizedQuery = camelizeObjectKeys(query);
    if (!this.data[collection]) return false;
    return this.data[collection].some((item) => {
      return Object.keys(normalizedQuery).every((key) => item[key] === normalizedQuery[key]);
    });
  }

  distinct(collection: string, field: string) {
    if (!this.data[collection]) return [];
    const normalizedField = toCamelCase(field);
    const values = this.data[collection]
      .map((item) => item[normalizedField])
      .filter((v) => v !== undefined && v !== null);
    return [...new Set(values)];
  }

  count(collection: string, query: AnyRecord | null = null) {
    const normalizedQuery = query ? camelizeObjectKeys(query) : null;
    if (!this.data[collection]) return 0;
    if (!normalizedQuery || Object.keys(normalizedQuery).length === 0) {
      return this.data[collection].length;
    }
    return this.data[collection].filter((item) => {
      return Object.keys(normalizedQuery).every((key) => item[key] === normalizedQuery[key]);
    }).length;
  }

  insertMany(collection: string, records: AnyRecord[]) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }

    const created = records.map((data) => {
      const id = this.getNextId(collection);
      const newItem = { id, ...camelizeObjectKeys(data) };
      this.data[collection].push(newItem);
      return newItem;
    });

    this.saveData();
    return created;
  }

  deleteMany(collection: string, queryOrIds: any) {
    if (!this.data[collection]) return 0;

    const before = this.data[collection].length;

    if (Array.isArray(queryOrIds)) {
      const parsedIds = queryOrIds.map((id) => parseInt(String(id), 10));
      this.data[collection] = this.data[collection].filter((item) => !parsedIds.includes(item.id));
    } else if (typeof queryOrIds === 'object' && queryOrIds !== null) {
      // If empty query {}, it matches all items
      if (Object.keys(queryOrIds).length === 0) {
        this.data[collection] = [];
      } else {
        const itemsToKeep = this.data[collection].filter((item) => {
          const matched = this.applyFilters([item], queryOrIds);
          return matched.length === 0; // Keep if NOT matched by the delete query
        });
        this.data[collection] = itemsToKeep;
      }
    }

    const deletedCount = before - this.data[collection].length;
    if (deletedCount > 0) this.saveData();
    return deletedCount;
  }
}

// ==================== ADAPTER SELECTION ====================

let dbInstance: DatabaseAdapter | null;

async function initDatabase() {
  if (dbInstance) return dbInstance;

  // Ensure dotenv is loaded before checking env vars
  const { default: dotenv } = await import('dotenv');
  dotenv.config({ path: path.join(process.cwd(), '.env') });

  const dbConnection = (process.env.DB_CONNECTION || 'json').toLowerCase();

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
