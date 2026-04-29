import { Router } from 'express';
import bonusRegistrationController from '../controllers/bonus-registration.controller';
import { requireAuth } from '@middleware/auth.middleware';
import { requirePermission } from '@middleware/rbac.middleware';

const router = Router();

router.use(requireAuth);

router.get('/', bonusRegistrationController.getRegistrations);
router.get('/:id', bonusRegistrationController.getRegistrationById);
router.put('/:id', requirePermission('bonus-campaigns:review'), bonusRegistrationController.updateRegistration);
router.delete('/:id', requirePermission('bonus-campaigns:delete'), bonusRegistrationController.deleteRegistration);

export default router;
