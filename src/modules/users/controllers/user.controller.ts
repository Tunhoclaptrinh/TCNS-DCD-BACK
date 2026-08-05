import { sanitizeUser } from '@utils/user.utils';
import userService from '@modules/users/services/user.service';
import userAvatarService from '@modules/users/services/user-avatar.service';
import userAccessService from '@modules/users/services/user-access.service';
import dutyService from '@modules/duty/services/duty.service';
import BaseController from '@shared/common/base-controller';
import ApiError from '@utils/api-error';
import type { AnyRecord } from '@app-types/common';

function sanitizeStats(stats: any, user: any, permissions: string[]) {
  const isSuperAdmin = permissions.includes('*');
  const hasFullStatsPermission =
    isSuperAdmin ||
    permissions.includes('users:view_stats:full') ||
    permissions.includes('users:list:all') ||
    permissions.includes('users:update:org') ||
    ['tb', 'pb', 'dt'].includes(user?.position);

  if (hasFullStatsPermission) return stats;

  const isCTV = user?.position === 'ctv';

  const sanitizeItem = (item: any) => {
    if (!item) return item;
    const clean = { ...item };
    // Always hide sensitive information for non-managers
    clean.alumni = 0;
    clean.locked = 0;
    clean.inactive = 0;
    clean.dismissed = 0;
    clean.total = clean.active || 0;

    if (isCTV) {
      clean.official = 0;
      clean.management = 0;
      clean.byRole = {};
      if (clean.byPosition) {
        clean.byPosition = { ctv: clean.byPosition.ctv || 0 };
      }
    }
    return clean;
  };

  const cleanStats = {
    global: sanitizeItem(stats.global),
    byDepartment: {} as Record<string, any>,
  };

  if (stats.byDepartment) {
    for (const [dept, item] of Object.entries(stats.byDepartment)) {
      cleanStats.byDepartment[dept] = sanitizeItem(item);
    }
  }

  return cleanStats;
}

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

  getAll = this.handle(async (req, res) => {
    const actorPermissions = req.user.permissions || [];
    const canReadAll = actorPermissions.includes('*') || actorPermissions.includes('users:list:all');
    const canReadDept = actorPermissions.includes('users:list:dept');

    const query = { ...req.parsedQuery };

    // Handle special 'others' tab filter (Dismissed, Locked, Expelled, or No Position)
    if (query.filter?.tab === 'others') {
      delete query.filter.tab;
      query.filter = {
        ...(query.filter || {}),
        $or: [{ status: { $in: ['dismissed', 'locked'] } }, { expelled: true }, { position: { $in: [null, ''] } }],
      };
    }

    // Strict rule: if the user's position is CTV, they can ONLY see CTVs, regardless of other permissions
    if (req.user.position === 'ctv') {
      query.filter = { ...(query.filter || {}), position: 'ctv' };
    }

    const result = await this.service.findAll(query);
    result.data = result.data.map((user) => sanitizeUser(user));
    this.ok(res, result);
  });

  getById = this.handle(async (req, res) => {
    const targetUser = await this.service.findById(req.params.id);
    if (!targetUser.success || !targetUser.data) {
      throw ApiError.notFound('Không tìm thấy thành viên');
    }

    userAccessService.assertCanReadProfile(req.user, targetUser.data);
    this.ok(res, sanitizeUser(targetUser.data));
  });

  create = this.handle(async (req, res) => {
    const data = await this.service.create(req.body, req.user);
    this.ok(res, sanitizeUser(data));
  });

  update = this.handle(async (req, res) => {
    // Prevent self-update via admin endpoint if it contains sensitive fields
    if (req.params.id === String(req.user.id)) {
      const sensitiveFields = ['position', 'department', 'role', 'isActive', 'status'];
      const hasSensitive = sensitiveFields.some((f) => req.body[f] !== undefined);
      if (hasSensitive) {
        throw ApiError.badRequest('Không thể tự cập nhật chức vụ hoặc trạng thái của bản thân');
      }
    } else {
      // Hierarchy check for others
      const targetUserResult = await this.service.findById(req.params.id);
      if (!targetUserResult.success) {
        throw ApiError.notFound('Không tìm thấy người dùng mục tiêu');
      }
      userAccessService.assertAuthority(req.user, targetUserResult.data, req.body.position);
    }

    const data = await userAvatarService.updateUserWithAvatar(
      req.params.id,
      req.body,
      this.getUploadedFile(req),
      req.user.id,
    );
    this.ok(res, sanitizeUser(data));
  });

  delete = this.handle(async (req, res) => {
    userAccessService.assertNotSelfAction(req.user, req.params.id, 'Không thể tự xóa tài khoản của chính mình');

    const result = await this.service.permanentDeleteUser(req.params.id, req.user.id, req.user.permissions || []);
    this.ok(res, result);
  });

  getUserStats = this.handle(async (req, res) => {
    const actorPermissions = req.user?.permissions || [];
    const query = { ...(req.query as Record<string, any>) };
    const data = await this.service.getUserStats(query);
    const sanitized = sanitizeStats(data, req.user, actorPermissions);
    this.ok(res, sanitized);
  });

  getMeStats = this.handle(async (req, res) => {
    const data = await dutyService.getUserStats(req.user.id);
    this.ok(res, data);
  });

  getUserActivity = this.handle(async (req, res) => {
    userAccessService.assertCanReadProfile(req.user, req.params.id);
    const data = await this.service.getUserActivity(req.params.id);
    this.ok(res, data);
  });

  toggleUserStatus = this.handle(async (req, res) => {
    userAccessService.assertNotSelfAction(req.user, req.params.id, 'Không thể vô hiệu hóa tài khoản của chính mình');

    const data = await this.service.toggleUserStatus(req.params.id, req.user);
    this.ok(res, data);
  });

  promoteUser = this.handle(async (req, res) => {
    userAccessService.assertNotSelfAction(
      req.user,
      req.params.id,
      'Không thể tự thay đổi vai trò hệ thống của chính mình',
    );

    const { role, reason } = req.body;
    if (!role) {
      throw ApiError.badRequest('Vai trò là bắt buộc');
    }

    const targetUser = await this.service.findById(req.params.id);
    userAccessService.assertAuthority(req.user, targetUser);

    const data = await this.service.promoteUser(req.params.id, role, reason, req.user.id, req.user.permissions || []);
    this.ok(res, data);
  });

  expelUser = this.handle(async (req, res) => {
    userAccessService.assertNotSelfAction(req.user, req.params.id, 'Không thể tự khai trừ tài khoản của chính mình');

    const data = await this.service.expelUser(req.params.id, req.body.reason, req.user.id, req.user.permissions || []);
    this.ok(res, data);
  });

  permanentDeleteUser = this.handle(async (req, res) => {
    userAccessService.assertNotSelfAction(req.user, req.params.id, 'Không thể tự xóa tài khoản của chính mình');

    const data = await this.service.permanentDeleteUser(req.params.id, req.user.id, req.user.permissions || []);
    this.ok(res, data);
  });

  updateProfile = this.handle(async (req, res) => {
    const updateData = this.buildProfileUpdatePayload(req.body as AnyRecord);
    const uploadedFile = this.getUploadedFile(req);

    if (Object.keys(updateData).length === 0 && !uploadedFile) {
      throw ApiError.badRequest('Không có trường dữ liệu nào để cập nhật');
    }

    const data = await userAvatarService.updateUserWithAvatar(
      req.user.id,
      { ...updateData, storeData: req.body.storeData },
      uploadedFile,
      req.user.id,
    );
    this.ok(res, sanitizeUser(data));
  });

  syncAlumniStatus = this.handle(async (req, res) => {
    const { userIds } = req.body;
    const count = await this.service.syncAlumniStatus(userIds, req.user.id);
    this.ok(res, { count, message: `Đã cập nhật ${count} thành viên sang trạng thái cựu thành viên` });
  });

  getPotentialAlumni = this.handle(async (_req, res) => {
    const data = await this.service.getPotentialAlumni();
    this.ok(
      res,
      data.map((u: any) => sanitizeUser(u)),
    );
  });
}

export default new UserController();
