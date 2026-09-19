import { Router } from 'express';
import { probationController } from '../controllers/probationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// List probation dashboard/records
router.get('/', authorize(['probation:read', 'employee:read']), probationController.list);

// Manager submits evaluation
router.post('/:employeeId/evaluate', authorize(['probation:write', 'Manager', 'HR', 'Admin']), probationController.evaluate);

// HR final review & decision
router.post('/:employeeId/review', authorize(['probation:write', 'HR', 'Admin', 'SuperAdmin']), probationController.review);

export default router;

