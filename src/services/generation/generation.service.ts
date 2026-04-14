import BaseService from '@shared/common/base-service';
import db from '@database';
import generationSchema from '../../schemas/generation.schema';
import ApiError from '@utils/api-error';

class GenerationService extends BaseService {
  constructor() {
    super('generations');
  }

  getSchema() {
    return generationSchema;
  }

  async beforeCreate(data) {
    const transformed = this.transformBySchema(data);

    // If setting as current, we need to unset others later in afterCreate/afterUpdate
    // but we can also do it here if we want to be safe.

    return {
      ...transformed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async afterCreate(item) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(item.id);
    }
  }

  async afterUpdate(item) {
    if (item.isCurrent) {
      await this.ensureOnlyOneCurrent(item.id);
    }
  }

  async ensureOnlyOneCurrent(currentId) {
    const generations = await db.findAll('generations');
    const updates = generations
      .filter((g) => g.id !== currentId && g.isCurrent)
      .map((g) => db.update('generations', g.id, { isCurrent: false, updatedAt: new Date().toISOString() }));

    if (updates.length > 0) {
      await Promise.all(updates);
    }

    // Also sync with duty_settings for compatibility
    const settings = await db.findOne('duty_settings', {});
    const currentGen = await db.findById('generations', currentId);
    if (settings && currentGen) {
      await db.update('duty_settings', settings.id, {
        currentGeneration: currentGen.name,
      });
    }
  }

  async setCurrent(id) {
    const item = await db.findById('generations', id);
    if (!item) throw ApiError.notFound('Generation not found');

    const updated = await db.update('generations', id, {
      isCurrent: true,
      updatedAt: new Date().toISOString(),
    });

    await this.ensureOnlyOneCurrent(id);
    return updated;
  }
}

export default new GenerationService();
