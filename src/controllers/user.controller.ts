import { sanitizeUser } from '@utils/helpers';
import userService from '@services/user.service';
import BaseController from '@utils/base-controller';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';

class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  getAll = async (req, res, next) => {
    try {
      const result = await this.service.findAll(req.parsedQuery);
      result.data = result.data.map((user) => sanitizeUser(user));
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req, res, next) => {
    try {
      const data = await this.service.findById(req.params.id);
      const targetId = parseInt(req.params.id, 10);
      const canReadOthers = ['admin', 'staff', 'researcher'].includes(req.user.role);

      if (req.user.id !== targetId && !canReadOthers) {
        throw ApiError.forbidden('Not authorized to view this profile');
      }

      res.json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };

  create = async (req, res, next) => {
    try {
      const data = await this.service.create(req.body);
      res.status(201).json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };

  update = async (req, res, next) => {
    try {
      const data = await this.service.update(req.params.id, req.body);
      res.json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      if (parseInt(req.params.id) === req.user.id) {
        throw ApiError.badRequest('Cannot delete your own account');
      }

      const result = await this.service.delete(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (req, res, next) => {
    try {
      const data = await this.service.getUserStats();
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  getUserActivity = async (req, res, next) => {
    try {
      const targetId = parseInt(req.params.id, 10);
      const canReadOthers = ['admin', 'staff', 'researcher'].includes(req.user.role);

      if (req.user.id !== targetId && !canReadOthers) {
        throw ApiError.forbidden('Not authorized');
      }

      const data = await this.service.getUserActivity(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  toggleUserStatus = async (req, res, next) => {
    try {
      if (parseInt(req.params.id) === req.user.id) {
        throw ApiError.badRequest('Không thể vô hiệu hóa tài khoản của chính mình');
      }

      const data = await this.service.toggleUserStatus(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  promoteUser = async (req, res, next) => {
    try {
      if (parseInt(req.params.id, 10) === req.user.id) {
        throw ApiError.badRequest('Cannot change your own role');
      }

      const { role, reason } = req.body;
      if (!role) {
        throw ApiError.badRequest('role is required');
      }

      const data = await this.service.promoteUser(req.params.id, role, reason, req.user.id, req.user.role);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  expelUser = async (req, res, next) => {
    try {
      if (parseInt(req.params.id, 10) === req.user.id) {
        throw ApiError.badRequest('Cannot expel your own account');
      }

      const data = await this.service.expelUser(req.params.id, req.body.reason, req.user.id, req.user.role);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  permanentDeleteUser = async (req, res, next) => {
    try {
      if (parseInt(req.params.id) === req.user.id) {
        throw ApiError.badRequest('Cannot delete your own account');
      }

      const data = await this.service.permanentDeleteUser(req.params.id, req.user.id, req.user.role);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const {
        name,
        lastName,
        firstName,
        dob,
        studentId,
        classId,
        hometown,
        position,
        department,
        phone,
        address,
        avatar,
        bio,
      } = req.body as AnyRecord;

      const updateData: AnyRecord = {};
      if (name) updateData.name = name;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (firstName !== undefined) updateData.firstName = firstName;
      if (dob) updateData.dob = dob;
      if (studentId) updateData.studentId = studentId;
      if (classId) updateData.classId = classId;
      if (hometown) updateData.hometown = hometown;
      if (position) updateData.position = position;
      if (department) updateData.department = department;
      if (phone) updateData.phone = phone;
      if (address) updateData.address = address;
      if (avatar) updateData.avatar = avatar;
      if (bio !== undefined) updateData.bio = bio;

      if (Object.keys(updateData).length === 0) {
        throw ApiError.badRequest('No fields to update');
      }

      const data = await this.service.update(req.user.id, updateData);
      res.json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };
}

export default new UserController();
