import BaseController from '@shared/common/base-controller';
import semestersService from '../services/semesters.service';

class SemestersController extends BaseController {
  constructor() {
    super(semestersService);
  }

  setCurrent = this.handle(async (req, res) => {
    const data = await semestersService.setCurrent(req.params.id);
    this.ok(res, {
      ...data,
      message: 'Đã đặt làm Học kỳ hiện tại',
    });
  });
}

export default new SemestersController();
