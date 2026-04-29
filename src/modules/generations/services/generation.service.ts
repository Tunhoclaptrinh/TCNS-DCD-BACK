import BaseService from '@shared/common/base-service';
import generationsRepository from '@modules/generations/repositories/generations.repository';
import generationSchema from '@modules/generations/schemas/generation.schema';
import auditLogsService from '@modules/audit-logs/services/audit-logs.service';
import db from '@database/mongo-database.adapter';
import ApiError from '@utils/api-error';
import type { AnyRecord, Identifier } from '@app-types/common';
import { logger } from '@utils/logger';

class GenerationService extends BaseService {
  constructor() {
    super('generations', generationsRepository);
  }

  getSchema() {
    return generationSchema;
  }

  async beforeCreate(data: AnyRecord) {
    const transformed = this.transformBySchema(data);

    return {
      ...transformed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async afterCreate(item: AnyRecord) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(item.id);
    }
  }

  async afterUpdate(item: AnyRecord) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(item.id);
    }

    // Auto-sync alumni if isActive changed to false
    if (item.isActive === false) {
      await this.syncUsersToAlumni(item.id);
    }
  }

  getAuditUserId(performer?: AnyRecord | Identifier) {
    const candidate = performer && typeof performer === 'object' ? performer.id : performer;
    return Number(candidate) || 0;
  }

  async create(data: AnyRecord, performer?: AnyRecord | Identifier) {
    const result = await super.create(data);

    if (result.success && result.data) {
      const created = result.data as AnyRecord;
      await auditLogsService.log({
        userId: this.getAuditUserId(performer),
        action: 'TẠO KHÓA',
        module: 'GENERATIONS',
        description: `Tạo khóa ${created.name || created.id}`,
        resourceId: String(created.id),
      });
    }

    return result;
  }

  async update(id: Identifier, data: AnyRecord, performer?: AnyRecord | Identifier) {
    const result = await super.update(id, data);

    if (result.success && result.data) {
      const updated = result.data as AnyRecord;
      await auditLogsService.log({
        userId: this.getAuditUserId(performer),
        action: 'CẬP NHẬT KHÓA',
        module: 'GENERATIONS',
        description: `Cập nhật khóa ${updated.name || updated.id}`,
        resourceId: String(updated.id),
      });
    }

    return result;
  }

  async delete(id: Identifier, performer?: AnyRecord | Identifier) {
    const generation = await this.repository.findById(id);
    const result = await super.delete(id);

    if (result.success) {
      await auditLogsService.log({
        userId: this.getAuditUserId(performer),
        action: 'XÓA KHÓA',
        module: 'GENERATIONS',
        description: `Xóa khóa ${generation?.name || id}`,
        resourceId: String(id),
      });
    }

    return result;
  }

  async syncUsersToAlumni(id: Identifier) {
    await db.updateMany(
      'users',
      { generationId: id, status: 'active' },
      {
        status: 'inactive',
        isActive: false, // Also deactivate account when moving to alumni
        updatedAt: new Date().toISOString(),
      },
    );
    logger.info(`Automatically moved members of generation ${id} to alumni status and deactivated their accounts`);
  }

  async ensureOnlyOneCurrent(currentId: Identifier) {
    const generations = await this.repository.findAll();
    const updates = generations
      .filter((g: any) => Number(g.id) !== Number(currentId) && g.isCurrent)
      .map((g: any) =>
        this.repository.update(g.id, {
          isCurrent: false,
          updatedAt: new Date().toISOString(),
        }),
      );

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Đồng bộ với duty_settings
    const settings = await db.findOne('duty_settings', {});
    const currentGen = await this.repository.findById(currentId);
    if (settings && currentGen) {
      await db.update('duty_settings', settings.id, {
        currentGeneration: (currentGen as any).name,
      });
    }
  }

  async setCurrent(id: Identifier, performer?: AnyRecord | Identifier) {
    const item = await this.repository.findById(id);
    if (!item) throw ApiError.notFound('Generation not found');

    const updated = await this.repository.update(id, {
      isCurrent: true,
      updatedAt: new Date().toISOString(),
    });

    await this.ensureOnlyOneCurrent(id);
    await auditLogsService.log({
      userId: this.getAuditUserId(performer),
      action: 'ĐẶT KHÓA HIỆN TẠI',
      module: 'GENERATIONS',
      description: `Đặt khóa ${updated.name || updated.id} làm khóa hiện tại`,
      resourceId: String(updated.id),
    });

    return updated;
  }
}

export default new GenerationService();
