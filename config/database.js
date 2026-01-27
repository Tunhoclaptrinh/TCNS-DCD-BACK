const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, '../database/db.json');

class JsonAdapter {
  constructor() {
    this.ensureDbDir();
    this.data = this.loadData();
    console.log('📂 JSON Database Adapter Loaded');
  }

  ensureDbDir() {
    const dir = path.dirname(DB_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  loadData() {
    try {
      if (!fs.existsSync(DB_FILE)) return this.getDefaultData();
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
      categories: []
    };
  }

  // Generic Find (All)
  async findAllAdvanced(collection, options = {}) {
    let items = this.data[collection] || [];
    // Basic pagination if requested
    if (options.page && options.limit) {
      const page = parseInt(options.page);
      const limit = parseInt(options.limit);
      const start = (page - 1) * limit;
      return {
        data: items.slice(start, start + limit),
        pagination: {
          page, limit, total: items.length
        }
      };
    }
    return { data: items, pagination: { total: items.length } };
  }

  async findById(collection, id) {
    return this.data[collection]?.find(item => item.id == id); // Loose equality for string/int IDs
  }

  async findOne(collection, query) {
     return this.data[collection]?.find(item => {
        return Object.keys(query).every(key => item[key] == query[key]);
     });
  }

  async create(collection, data) {
    if (!this.data[collection]) this.data[collection] = [];
    const id = this.getNextId(collection);
    const newItem = { id, ...data, createdAt: new Date().toISOString() };
    this.data[collection].push(newItem);
    this.saveData();
    return newItem;
  }

  async update(collection, id, data) {
    const index = this.data[collection]?.findIndex(item => item.id == id);
    if (index === -1) return null;
    
    this.data[collection][index] = { ...this.data[collection][index], ...data, updatedAt: new Date().toISOString() };
    this.saveData();
    return this.data[collection][index];
  }

  async delete(collection, id) {
    const index = this.data[collection]?.findIndex(item => item.id == id);
    if (index === -1) return false;
    this.data[collection].splice(index, 1);
    this.saveData();
    return true;
  }

  getNextId(collection) {
    const items = this.data[collection] || [];
    if (items.length === 0) return 1;
    // Assuming numeric IDs
    const maxId = items.reduce((max, item) => Math.max(max, parseInt(item.id) || 0), 0);
    return maxId + 1;
  }
}

module.exports = new JsonAdapter();
