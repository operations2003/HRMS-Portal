import { Router } from 'express';
import { employeeController } from '../controllers/employeeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateCreateEmployee, validateUpdateEmployee } from '../validators/employeeValidator.js';

const router = Router();

// All employee routes require authentication
router.use(authenticate);

router.get('/metadata', authorize(['employee:read', 'employee:write']), employeeController.getMetadata);
router.get('/', authorize('employee:read'), employeeController.list);
router.get('/:id', authorize('employee:read'), employeeController.getById);
router.get('/:id/timeline', authorize('employee:read'), employeeController.getTimeline);
router.post('/', authorize('employee:write'), validate(validateCreateEmployee), employeeController.create);
router.put('/:id', authorize('employee:write'), validate(validateUpdateEmployee), employeeController.update);
router.delete('/:id', authorize('employee:delete'), employeeController.delete);

export default router;
