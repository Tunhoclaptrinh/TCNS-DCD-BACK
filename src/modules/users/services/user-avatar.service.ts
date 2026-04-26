import ApiError from '@utils/api-error';
import uploadService from '@modules/files/services/upload.service';
import userService from '@modules/users/services/user.service';
import type { AnyRecord, Identifier } from '@app-types/common';

class UserAvatarService {
  getAvatarUploadMiddleware() {
    return uploadService.getFlexibleSingleUpload(['avatar', 'image'], 'avatar');
  }

  buildUploadOptions(actorId?: Identifier, storeData?: unknown) {
    return {
      uploadedBy: actorId,
      storeData,
    };
  }

  removeInternalUpdateFields(payload: AnyRecord = {}) {
    const nextPayload = { ...payload };
    delete nextPayload.storeData;
    return nextPayload;
  }

  async safelyDeleteAvatar(avatarUrl?: string | null) {
    if (!avatarUrl) return;

    try {
      await uploadService.deleteFile(avatarUrl);
    } catch (_error) {
      // Bỏ qua lỗi xóa avatar cũ để không chặn luồng cập nhật profile.
    }
  }

  // Giữ toàn bộ vòng đời upload avatar trong service để controller không phải tự xử lý rollback.
  async updateUserWithAvatar(targetUserId: Identifier, payload: AnyRecord = {}, file?: any, actorId?: Identifier) {
    const existingUserResult = await userService.findById(targetUserId);
    if (!existingUserResult?.success || !existingUserResult.data) {
      throw ApiError.notFound('Không tìm thấy người dùng');
    }

    const sanitizedPayload = this.removeInternalUpdateFields(payload);
    if (!file) {
      return await userService.update(targetUserId, sanitizedPayload, actorId ?? targetUserId);
    }

    const previousAvatar = existingUserResult.data.avatar;
    const uploadOptions = this.buildUploadOptions(actorId ?? targetUserId, payload.storeData);
    const uploadedAvatar = await uploadService.uploadAvatar(file, targetUserId, uploadOptions);
    const uploadedAvatarUrl = uploadedAvatar.secureUrl || uploadedAvatar.url;
    const nextPayload = {
      ...sanitizedPayload,
      avatar: uploadedAvatarUrl,
    };

    try {
      const updatedUser = await userService.update(targetUserId, nextPayload, actorId ?? targetUserId);

      if (previousAvatar && previousAvatar !== nextPayload.avatar) {
        await this.safelyDeleteAvatar(previousAvatar);
      }

      return updatedUser;
    } catch (error) {
      await this.safelyDeleteAvatar(uploadedAvatarUrl);
      throw error;
    }
  }
}

export default new UserAvatarService();
