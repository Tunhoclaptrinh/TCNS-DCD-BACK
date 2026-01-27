const router = require('express').Router();
const userController = require('../controllers/user.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateSchema } = require('../middleware/validation.middleware');

router.put('/profile', protect, userController.updateProfile);

// Admin routes
router.get('/', protect, authorize('admin'), userController.getAll);
router.post('/', protect, authorize('admin'), validateSchema('users'), userController.create);
router.get('/:id', protect, userController.getById); // Self or Admin check in controller
router.put('/:id', protect, authorize('admin'), userController.update);
router.delete('/:id', protect, authorize('admin'), userController.delete);

module.exports = router;
