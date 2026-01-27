const BaseService = require('../utils/BaseService');

class UserService extends BaseService {
  constructor() {
    super('users');
  }

  // Add custom user logic/validations here if needed
}

module.exports = new UserService();
