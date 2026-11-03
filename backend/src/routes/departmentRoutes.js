import { Router } from 'express';
import { departmentController } from '../controllers/departmentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// Department management endpoints
router.get('/', (req, res, next) => {
  if (req.user) return next();
  return authorize('dept:read')(req, res, next);
}, departmentController.listDepartments);
router.get('/:id', authorize('dept:read'), departmentController.getDepartmentById);
router.post('/', authorize(['dept:write', 'employee:write']), departmentController.createDepartment);
router.put('/:id', authorize(['dept:write', 'employee:write']), departmentController.updateDepartment);
router.delete('/:id', authorize('dept:write'), departmentController.deleteDepartment);

export default router;
