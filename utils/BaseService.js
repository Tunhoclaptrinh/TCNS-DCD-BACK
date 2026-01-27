/**
 * Base Service - Generic CRUD Service
 */
const db = require("../config/database");
const schemas = require("../schemas");

class BaseService {
  constructor(collectionName) {
    this.collection = collectionName;
    this.schema = schemas[collectionName] || null;
  }

  // ... (Simplified version of BaseService) ...
  // Validating by schema
  async validateBySchema(data, options = {}) {
     if (!this.schema) return { success: true };
     // Basic validation logic would go here, simplified for Base
     return { success: true };
  }

  // CRUD
  async findAll(options = {}) {
    try {
      const result = await db.findAllAdvanced(this.collection, options);
      return {
        success: true,
        data: result.data,
        pagination: result.pagination,
      };
    } catch (error) {
      throw error;
    }
  }

  async findById(id) {
    try {
      const item = await db.findById(this.collection, id);
      if (!item) {
        return {
          success: false,
          message: `${this.collection} not found`,
          statusCode: 404,
        };
      }
      return {
        success: true,
        data: item,
      };
    } catch (error) {
       throw error;
    }
  }

  async create(data) {
     const item = await db.create(this.collection, data);
     return { success: true, data: item };
  }

  async update(id, data) {
    const updated = await db.update(this.collection, id, data);
    return { success: true, data: updated };
  }

  async delete(id) {
    await db.delete(this.collection, id);
    return { success: true };
  }
}

module.exports = BaseService;
