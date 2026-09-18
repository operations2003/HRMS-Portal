import { Router } from 'express';
import { exitController } from '../controllers/exitController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateResignation,
  validateManagerReview,
  validateHrApproval,
  validateClearanceUpdate,
  validateFnfSettlement,
} from '../validators/exitValidator.js';

const router = Router();

// All exit routes require authenticated session
router.use(authenticate);

// =========================================================================
// 1. Employee Self-Service Exit Operations
// =========================================================================
router.post(
  '/resign',
  authorize(['exit:write']),
  validate(validateResignation),
  exitController.submitResignation
);

router.get(
  '/my',
  authorize(['exit:read']),
  exitController.getMyExit
);

// =========================================================================
// 2. Manager Team Exit Operations
// =========================================================================
router.get(
  '/team',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:read']),
  exitController.getTeamExits
);

router.post(
  '/requests/:id/manager-review',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:review']),
  validate(validateManagerReview),
  exitController.managerReview
);

// =========================================================================
// 3. HR & Admin Organization-Wide Exit Management
// =========================================================================
router.get(
  ['/requests', '/all'],
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin', 'exit:read']),
  exitController.getAllExits
);

router.get(
  '/requests/:id',
  authorize(['exit:read']),
  exitController.getExitById
);

router.post(
  '/requests/:id/hr-approve',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin']),
  validate(validateHrApproval),
  exitController.hrApprove
);

// =========================================================================
// 4. Departmental Clearances
// =========================================================================
router.get(
  '/requests/:id/clearances',
  authorize(['exit:read']),
  exitController.getClearances
);

router.patch(
  '/clearances/:taskId',
  authorize(['exit:write', 'exit:admin']),
  validate(validateClearanceUpdate),
  exitController.updateClearanceTask
);

// =========================================================================
// 5. Full & Final (FnF) Settlement Operations
// =========================================================================
router.get(
  '/requests/:id/fnf',
  authorize(['fnf:manage', 'exit:read']),
  exitController.getFnf
);

router.post(
  '/requests/:id/fnf',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['fnf:manage']),
  validate(validateFnfSettlement),
  exitController.calculateFnf
);

// =========================================================================
// 6. Access Deprovisioning & Final Sign-Off
// =========================================================================
router.post(
  '/requests/:id/deprovision',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['deprovision:manage', 'exit:admin']),
  exitController.deprovisionAccess
);

export default router;

