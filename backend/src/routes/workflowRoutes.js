import { Router } from 'express';
import { workflowController } from '../controllers/workflowController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateWorkflowAction } from '../validators/workflowValidator.js';

const router = Router();

// All workflow routes require authentication
router.use(authenticate);

// Pending queue for managers & HR
router.get(
  '/pending',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['workflow:read', 'workflow:action']),
  workflowController.getPendingQueue
);

// Workflow instance details
router.get(
  '/:id',
  authorize(['workflow:read']),
  workflowController.getById
);

// Perform workflow action (APPROVE, REJECT, RETURN)
router.post(
  '/:id/action',
  authorize(['workflow:action']),
  validate(validateWorkflowAction),
  workflowController.executeAction
);

// Immutable audit trail for an entity
router.get(
  '/entity/:entityType/:entityId/audit',
  authorize(['workflow:read']),
  workflowController.getAuditTrail
);

export default router;
