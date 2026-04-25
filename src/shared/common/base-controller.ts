import type { NextFunction, Request, Response } from 'express';
import type { AnyRecord } from '@app-types/common';
import type { CrudService } from '@app-types/service';

class BaseController {
  protected readonly service: CrudService | null;

  constructor(service: CrudService | null = null) {
    this.service = service;
  }

  protected handle(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        await handler(req, res, next);
      } catch (error) {
        next(error);
      }
    };
  }

  protected ok(res: Response, data: any) {
    if (typeof data === 'object' && data !== null && typeof data.success === 'boolean') {
      return res.json(data);
    }
    return res.json({ success: true, data });
  }

  protected created(res: Response, data: any) {
    if (typeof data === 'object' && data !== null && typeof data.success === 'boolean') {
      return res.status(201).json(data);
    }
    return res.status(201).json({ success: true, data });
  }

  protected requireService() {
    if (!this.service) {
      throw new Error('BaseController requires a service for CRUD handlers');
    }

    return this.service;
  }

  getAll = this.handle(async (req: Request, res: Response) => {
    const result = await this.requireService().findAll(req.parsedQuery);
    this.ok(res, result);
  });

  getById = this.handle(async (req: Request, res: Response) => {
    const data = await this.requireService().findById(req.params.id);
    this.ok(res, data);
  });

  create = this.handle(async (req: Request, res: Response) => {
    const data = await this.requireService().create(req.body);
    this.created(res, data);
  });

  update = this.handle(async (req: Request, res: Response) => {
    const data = await this.requireService().update(req.params.id, req.body);
    this.ok(res, data);
  });

  patch = this.handle(async (req: Request, res: Response) => {
    const data = await this.requireService().patch(req.params.id, req.body);
    this.ok(res, data);
  });

  delete = this.handle(async (req: Request, res: Response) => {
    const result = await this.requireService().delete(req.params.id);
    this.ok(res, result);
  });

  search = this.handle(async (req: Request, res: Response) => {
    const { q } = req.query;
    if (!q) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const searchQuery = Array.isArray(q) ? String(q[0]) : String(q);
    const result = await this.requireService().search(searchQuery, req.parsedQuery);
    this.ok(res, result);
  });

  count = this.handle(async (req: Request, res: Response) => {
    const count = await this.requireService().count(req.parsedQuery?.filter || {});
    this.ok(res, { count });
  });

  bulk = this.handle(async (req: Request, res: Response) => {
    const { operation, items, updates, ids } = req.body;
    const service = this.requireService();
    let result: AnyRecord;

    switch (operation) {
      case 'create':
        result = await service.bulkCreate(items || []);
        break;
      case 'update':
        result = await service.bulkUpdate(updates || []);
        break;
      case 'delete':
        result = await service.bulkDelete(ids || items || []);
        break;
      default:
        return res.status(400).json({ message: 'Invalid bulk operation' });
    }

    this.ok(res, {
      success: result.failed === 0,
      message: `Bulk ${operation} completed: ${result.success} succeeded, ${result.failed} failed`,
      data: result,
    });
  });

  validate = this.handle(async (req: Request, res: Response) => {
    const result = await this.requireService().validateBySchema(req.body);
    this.ok(res, {
      valid: result.success,
      errors: result.errors,
    });
  });
}

export default BaseController;
