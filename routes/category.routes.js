const router = require('express').Router();
const categoryController = require('../controllers/category.controller');
const { protect, authorize } = require('../middleware/auth.middleware');
const { validateSchema } = require('../middleware/validation.middleware');

// Public read
router.get('/', categoryController.getAll);
router.get('/:id', categoryController.getById);

// Admin write
router.post('/', protect, authorize('admin'), validateSchema('categories'), categoryController.create);
router.put('/:id', protect, authorize('admin'), categoryController.update);
router.delete('/:id', protect, authorize('admin'), categoryController.delete);

module.exports = router;
