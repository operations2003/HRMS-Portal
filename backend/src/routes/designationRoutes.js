import { Router } from 'express';
import { designationController } from '../controllers/designationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// Designation management endpoints (allow dept:read / employee:read and dept:write / employee:write)
router.get('/', authorize(['dept:read', 'employee:read']), designationController.listDesignations);
router.get('/:id', authorize(['dept:read', 'employee:read']), designationController.getDesignationById);
router.post('/', authorize(['dept:write', 'employee:write']), designationController.createDesignation);
router.put('/:id', authorize(['dept:write', 'employee:write']), designationController.updateDesignation);
router.delete('/:id', authorize(['dept:write', 'employee:write']), designationController.deleteDesignation);

export default router;
