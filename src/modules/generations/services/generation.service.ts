import BaseService from '@shared/common/base-service';
import generationsRepository from '@modules/generations/repositories/generations.repository';
import generationSchema from '@modules/generations/schemas/generation.schema';
import db from '@database/mongo-database.adapter';
import ApiError from '@utils/api-error';
import type { AnyRecord, Identifier } from '@app-types/common';

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

  async afterUpdate(id: Identifier, item: AnyRecord) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(id);
    }
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

  async setCurrent(id: Identifier) {
    const item = await this.repository.findById(id);
    if (!item) throw ApiError.notFound('Generation not found');

    const updated = await this.repository.update(id, {
      isCurrent: true,
      updatedAt: new Date().toISOString(),
    });

    await this.ensureOnlyOneCurrent(id);
    return updated;
  }
}

export default new GenerationService();
