import BaseController from '@shared/common/base-controller';
import academicPeriodService from '@modules/academic-periods/services/academic-period.service';
import type { Request, Response } from 'express';

class AcademicPeriodController extends BaseController {
  constructor() {
    super(academicPeriodService);
  }

  getCurrent = this.handle(async (req: Request, res: Response) => {
    const data = await (this.service as any).getCurrentPeriod();
    this.ok(res, data);
  });

  create = this.handle(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id;
    const data = await (this.service as any).createPeriod(req.body, actorId);
    this.created(res, data);
  });

  update = this.handle(async (req: Request, res: Response) => {
    const actorId = (req as any).user?.id;
    const data = await (this.service as any).updatePeriod(req.params.id, req.body, actorId);
    this.ok(res, data);
  });
}

export default new AcademicPeriodController();
