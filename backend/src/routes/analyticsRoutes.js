import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

router.get(
  '/workforce',
  authorize(['analytics:read', 'HR', 'Admin', 'SuperAdmin', 'Manager']),
  analyticsController.getWorkforceAnalytics
);

export default router;

