const BaseController = require('../utils/BaseController');
const userService = require('../services/user.service');
const { sanitizeUser } = require('../utils/helpers');

class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  // Override to sanitize
  getById = async (req, res, next) => {
    try {
      const result = await this.service.findById(req.params.id);
      if (!result.success) return res.status(404).json(result);
      // Authorization check (simplified)
      if (req.user.role !== 'admin' && req.user.id != req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
      res.json({ success: true, data: sanitizeUser(result.data) });
    } catch (error) {
       next(error);
    }
  };
  
  updateProfile = async (req, res, next) => {
      try {
          const result = await this.service.update(req.user.id, req.body);
          res.json({ success: true, data: sanitizeUser(result.data) });
      } catch (error) {
          next(error);
      }
  };
}

module.exports = new UserController();
