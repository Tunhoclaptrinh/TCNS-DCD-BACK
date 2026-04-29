import BaseController from '@shared/common/base-controller';
import semestersService from '../services/semesters.service';
import type { Request, Response, NextFunction } from 'express';

class SemestersController extends BaseController {
  constructor() {
    super(semestersService);
  }

  // Override to ensure arrow function binding and visibility
  getAll = this.handle(async (req: Request, res: Response) => {
    const result = await this.requireService().findAll(req.parsedQuery);
    this.ok(res, result);
  });

  getById = this.handle(async (req: Request, res: Response) => {
    const data = await this.requireService().findById(req.params.id);
    this.ok(res, data);
  });

  setCurrent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await semestersService.setCurrent(req.params.id);
      this.ok(res, {
        ...data,
        message: 'Đã đặt làm Học kỳ hiện tại',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new SemestersController();
