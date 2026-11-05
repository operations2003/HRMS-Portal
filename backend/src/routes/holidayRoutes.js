import { Router } from 'express';
import { holidayController } from '../controllers/holidayController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// Authentication required
router.use(authenticate);

// 1. List holidays (All authenticated users can view company holidays)
router.get('/', holidayController.list);

// 2. Admin holiday management actions
router.post(
  '/',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'CEO']),
  holidayController.create
);

router.put(
  '/:id',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'CEO']),
  holidayController.update
);

router.delete(
  '/:id',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'CEO']),
  holidayController.delete
);

export default router;

