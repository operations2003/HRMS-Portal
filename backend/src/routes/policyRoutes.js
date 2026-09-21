import { Router } from 'express';
import { policyController } from '../controllers/policyController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

// View-only endpoints accessible to all authenticated users (Employees, Managers, HR, Admin)
router.get('/', policyController.listPolicies);
router.get('/:id', policyController.getPolicyById);

// Admin & HR restricted policy publishing and management
router.post('/', policyController.createPolicy);
router.put('/:id', policyController.updatePolicy);
router.delete('/:id', policyController.deletePolicy);

export default router;
