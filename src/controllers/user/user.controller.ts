import { sanitizeUser } from '@utils/helpers';
import userService from '@services/user/user.service';
import userAvatarService from '@services/user/user-avatar.service';
import userAccessService from '@services/user/user-access.service';
import BaseController from '@utils/base-controller';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';

class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  getAvatarUploadMiddleware() {
    return userAvatarService.getAvatarUploadMiddleware();
  }

  getUploadedFile(req) {
    if (req.file) {
      return req.file;
    }

    const files = req.files || {};
    return files.avatar?.[0] || files.image?.[0] || null;
  }

  buildProfileUpdatePayload(body: AnyRecord) {
    const allowedFields = [
      'name',
      'lastName',
      'firstName',
      'dob',
      'studentId',
      'classId',
      'hometown',
      'position',
      'department',
      'phone',
      'address',
      'avatar',
      'bio',
    ];

    return allowedFields.reduce((payload, field) => {
      if (body[field] !== undefined) {
        payload[field] = body[field];
      }
      return payload;
    }, {} as AnyRecord);
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
      userAccessService.assertCanReadProfile(req.user, req.params.id);
      const data = await this.service.findById(req.params.id);

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
      const data = await userAvatarService.updateUserWithAvatar(
        req.params.id,
        req.body,
        this.getUploadedFile(req),
        req.user.id,
      );
      res.json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };

  delete = async (req, res, next) => {
    try {
      userAccessService.assertNotSelfAction(req.user, req.params.id, 'Cannot delete your own account');

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
      userAccessService.assertCanReadProfile(req.user, req.params.id);
      const data = await this.service.getUserActivity(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  toggleUserStatus = async (req, res, next) => {
    try {
      userAccessService.assertNotSelfAction(req.user, req.params.id, 'Không thể vô hiệu hóa tài khoản của chính mình');

      const data = await this.service.toggleUserStatus(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  promoteUser = async (req, res, next) => {
    try {
      userAccessService.assertNotSelfAction(req.user, req.params.id, 'Cannot change your own role');

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
      userAccessService.assertNotSelfAction(req.user, req.params.id, 'Cannot expel your own account');

      const data = await this.service.expelUser(req.params.id, req.body.reason, req.user.id, req.user.role);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  permanentDeleteUser = async (req, res, next) => {
    try {
      userAccessService.assertNotSelfAction(req.user, req.params.id, 'Cannot delete your own account');

      const data = await this.service.permanentDeleteUser(req.params.id, req.user.id, req.user.role);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req, res, next) => {
    try {
      const updateData = this.buildProfileUpdatePayload(req.body as AnyRecord);
      const uploadedFile = this.getUploadedFile(req);

      if (Object.keys(updateData).length === 0 && !uploadedFile) {
        throw ApiError.badRequest('No fields to update');
      }

      const data = await userAvatarService.updateUserWithAvatar(
        req.user.id,
        { ...updateData, storeData: req.body.storeData },
        uploadedFile,
        req.user.id,
      );
      res.json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };
}

export default new UserController();
