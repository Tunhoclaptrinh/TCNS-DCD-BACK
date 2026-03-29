import type { NextFunction, Request, Response } from 'express';
import type { AnyRecord } from '@app-types/common';
import type { CrudService } from '@app-types/service';

class BaseController {
  service: CrudService;

  constructor(service: CrudService) {
    this.service = service;
  }

  getAll = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.findAll(req.parsedQuery);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.findById(req.params.id);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(req.body);
      res.status(201).json(data);
    } catch (error) {
      next(error);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await this.service.update(req.params.id, req.body);
      res.json(data);
    } catch (error) {
      next(error);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.delete(req.params.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  search = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { q } = req.query;
      if (!q) {
        return res.status(400).json({ message: 'Search query is required' });
      }
      const searchQuery = Array.isArray(q) ? String(q[0]) : String(q);
      const result = await this.service.search(searchQuery, req.parsedQuery);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  count = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const count = await this.service.count(req.parsedQuery?.filter || {});
      res.json({ count });
    } catch (error) {
      next(error);
    }
  };

  bulk = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { operation, items, updates, ids } = req.body;
      let result: AnyRecord;

      switch (operation) {
        case 'create':
          result = await this.service.bulkCreate(items || []);
          break;
        case 'update':
          result = await this.service.bulkUpdate(updates || []);
          break;
        case 'delete':
          result = await this.service.bulkDelete(ids || items || []);
          break;
        default:
          return res.status(400).json({ message: 'Invalid bulk operation' });
      }

      res.json({
        success: result.failed === 0,
        message: `Bulk ${operation} completed: ${result.success} succeeded, ${result.failed} failed`,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  validate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.service.validateBySchema(req.body);
      res.json({
        valid: result.success,
        errors: result.errors,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default BaseController;
