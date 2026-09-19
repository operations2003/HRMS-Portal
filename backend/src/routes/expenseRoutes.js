import { Router } from 'express';
import { expenseController } from '../controllers/expenseController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

router.get('/', authorize(['expense:read', 'employee:read']), expenseController.list);
router.post('/', authorize(['expense:write', 'employee:read']), expenseController.submit);
router.patch(['/:id/review', '/:id/approve'], authorize(['expense:approve', 'Manager', 'HR', 'Admin']), expenseController.review);

export default router;
