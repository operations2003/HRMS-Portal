import { Router } from 'express';
import { departmentController } from '../controllers/departmentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// Department management endpoints
router.get('/', authorize('dept:read'), departmentController.listDepartments);
router.get('/:id', authorize('dept:read'), departmentController.getDepartmentById);
router.post('/', authorize('dept:write'), departmentController.createDepartment);
router.put('/:id', authorize('dept:write'), departmentController.updateDepartment);
router.delete('/:id', authorize('dept:write'), departmentController.deleteDepartment);

export default router;
