import bonusRegistrationService from '@modules/bonus-registrations/services/bonus-registration.service';
import BaseController from '@shared/common/base-controller';

class BonusRegistrationController extends BaseController {
  getRegistrations = this.handle(async (req, res) => {
    const data = await bonusRegistrationService.findAll(req.parsedQuery || {});
    this.ok(res, data);
  });

  getRegistrationById = this.handle(async (req, res) => {
    const data = await bonusRegistrationService.findById(req.params.id);
    this.ok(res, data);
  });

  updateRegistration = this.handle(async (req, res) => {
    const data = await bonusRegistrationService.update(req.params.id, req.body);
    this.ok(res, data);
  });

  deleteRegistration = this.handle(async (req, res) => {
    await bonusRegistrationService.delete(req.params.id);
    this.ok(res, { success: true });
  });
}

export default new BonusRegistrationController();
