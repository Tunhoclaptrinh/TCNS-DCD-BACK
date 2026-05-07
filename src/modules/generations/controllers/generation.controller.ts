import BaseController from '@shared/common/base-controller';
import generationService from '@modules/generations/services/generation.service';

class GenerationController extends BaseController {
  constructor() {
    super(generationService);
  }

  create = this.handle(async (req, res) => {
    const data = await generationService.create(req.body, req.user?.id);
    this.created(res, data);
  });

  update = this.handle(async (req, res) => {
    const data = await generationService.update(req.params.id, req.body, req.user?.id);
    this.ok(res, data);
  });

  delete = this.handle(async (req, res) => {
    const data = await generationService.delete(req.params.id, req.user?.id);
    this.ok(res, data);
  });

  setCurrent = this.handle(async (req, res) => {
    const data = await generationService.setCurrent(req.params.id, req.user?.id);
    this.ok(res, {
      ...data,
      message: 'Đã đặt làm Khóa hiện tại',
    });
  });
}

export default new GenerationController();
