import BaseController from '@utils/base-controller';
import generationService from '@services/generation/generation.service';

class GenerationController extends BaseController {
  constructor() {
    super(generationService);
  }

  setCurrent = async (req, res, next) => {
    try {
      const data = await (this.service as any).setCurrent(req.params.id);
      res.json({
        success: true,
        data,
        message: 'Đã đặt làm Khóa hiện tại',
      });
    } catch (error) {
      next(error);
    }
  };
}

export default new GenerationController();
