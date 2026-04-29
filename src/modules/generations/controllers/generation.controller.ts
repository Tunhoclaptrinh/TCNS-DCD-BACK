import BaseController from '@shared/common/base-controller';
import generationService from '@modules/generations/services/generation.service';
import type { Request, Response, NextFunction } from 'express';

class GenerationController extends BaseController {
  constructor() {
    super(generationService);
  }

  create = this.handle(async (req: Request, res: Response) => {
    const data = await generationService.create(req.body, (req as any).user?.id);
    this.created(res, data);
  });

  update = this.handle(async (req: Request, res: Response) => {
    const data = await generationService.update(req.params.id, req.body, (req as any).user?.id);
    this.ok(res, data);
  });

  delete = this.handle(async (req: Request, res: Response) => {
    const data = await generationService.delete(req.params.id, (req as any).user?.id);
    this.ok(res, data);
  });

  setCurrent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await generationService.setCurrent(req.params.id, (req as any).user?.id);
      this.ok(res, {
        ...data,
        message: 'Đã đặt làm Khóa hiện tại',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new GenerationController();
