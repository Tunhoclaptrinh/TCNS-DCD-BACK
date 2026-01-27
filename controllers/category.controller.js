const BaseController = require('../utils/BaseController');
const categoryService = require('../services/category.service');

class CategoryController extends BaseController {
  constructor() {
    super(categoryService);
  }
}

module.exports = new CategoryController();
