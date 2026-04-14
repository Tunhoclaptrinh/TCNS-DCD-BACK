import BaseController from '@shared/common/base-controller';
import generationService from '@modules/generations/services/generation.service';
import type { Request, Response, NextFunction } from 'express';

class GenerationController extends BaseController {
  constructor() {
    super(generationService);
  }

  setCurrent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await generationService.setCurrent(req.params.id);
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
