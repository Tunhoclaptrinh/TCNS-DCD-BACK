const BaseService = require('../utils/BaseService');

class CategoryService extends BaseService {
  constructor() {
    super('categories');
  }
}

module.exports = new CategoryService();
