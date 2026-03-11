import { sanitizeUser } from '@utils/helpers';
import userService from '@services/user.service';
import BaseController from '@utils/base-controller';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';
import uploadService from '@services/common/upload.service';

class UserController extends BaseController {
  constructor() {
    super(userService);
  }

  getAvatarUploadMiddleware() {
    return uploadService.getSingleUpload('avatar', 'avatars');
  }

  safelyDeleteAvatar = async (avatarUrl?: string | null) => {
    if (!avatarUrl) return;

    try {
      await uploadService.deleteFile(avatarUrl);
    } catch (_error) {
      // Ignore non-Cloudinary or already-deleted avatars.
    }
  };

  updateUserWithUploadedAvatar = async (targetUserId: string | number, payload: AnyRecord, file?: any) => {
    const existingUserResult = await this.service.findById(targetUserId);
    if (!existingUserResult?.success || !existingUserResult.data) {
      throw ApiError.notFound('User not found');
    }

    if (!file) {
      return await this.service.update(targetUserId, payload);
    }

    const previousAvatar = existingUserResult.data.avatar;
    const uploadedAvatar = await uploadService.uploadAvatar(file, targetUserId);
    const nextPayload = {
      ...payload,
      avatar: uploadedAvatar.secureUrl || uploadedAvatar.url,
    };

    try {
      const updatedUser = await this.service.update(targetUserId, nextPayload);

      if (previousAvatar && previousAvatar !== nextPayload.avatar) {
        await this.safelyDeleteAvatar(previousAvatar);
      }

      return updatedUser;
    } catch (error) {
      await this.safelyDeleteAvatar(uploadedAvatar.secureUrl || uploadedAvatar.url);
      throw error;
    }
  };

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
      const data = await this.updateUserWithUploadedAvatar(req.params.id, req.body, req.file);
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

      if (Object.keys(updateData).length === 0 && !req.file) {
        throw ApiError.badRequest('No fields to update');
      }

      const data = await this.updateUserWithUploadedAvatar(req.user.id, updateData, req.file);
      res.json(sanitizeUser(data));
    } catch (error) {
      next(error);
    }
  };
}

export default new UserController();
