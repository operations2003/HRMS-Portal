import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);
router.get('/stats', authorize('dashboard:read'), dashboardController.getStats);

export default router;
