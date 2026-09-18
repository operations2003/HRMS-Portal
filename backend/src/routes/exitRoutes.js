import { Router } from 'express';
import { exitController } from '../controllers/exitController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateResignation,
  validateManagerReview,
  validateHrApproval,
  validateHrReject,
  validateClearanceUpdate,
  validateCustomClearanceTask,
  validateFnfSettlement,
  validateAccessRemoval,
  validateOffboardingUpdate,
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

router.post(
  '/requests/:id/withdraw',
  authorize(['exit:write']),
  exitController.withdrawResignation
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
  '/admin/stats',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin', 'exit:read']),
  exitController.getAdminStats
);

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

router.post(
  '/requests/:id/hr-reject',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin']),
  validate(validateHrReject),
  exitController.hrReject
);

// =========================================================================
// 4. Departmental Clearances
// =========================================================================
router.get(
  '/requests/:id/clearances',
  authorize(['exit:read']),
  exitController.getClearances
);

router.post(
  '/requests/:id/clearances',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin']),
  validate(validateCustomClearanceTask),
  exitController.createClearanceTask
);

router.patch(
  '/clearances/:taskId',
  authorize(['exit:write', 'exit:admin']),
  validate(validateClearanceUpdate),
  exitController.updateClearanceTask
);

// =========================================================================
// 5. Offboarding Dossier & Milestone Tracking
// =========================================================================
router.get(
  '/requests/:id/offboarding',
  authorize(['exit:read']),
  exitController.getOffboarding
);

router.patch(
  '/requests/:id/offboarding',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin']),
  validate(validateOffboardingUpdate),
  exitController.updateOffboarding
);

// =========================================================================
// 6. Access Removal (Granular Step)
// =========================================================================
router.post(
  '/requests/:id/access-removal',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['deprovision:manage', 'exit:admin']),
  validate(validateAccessRemoval),
  exitController.removeAccess
);

// =========================================================================
// 7. Full & Final (FnF) Settlement Operations
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

router.post(
  '/requests/:id/fnf/approve',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['fnf:manage']),
  exitController.approveFnf
);

router.post(
  '/requests/:id/fnf/disburse',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['fnf:manage']),
  exitController.disburseFnf
);

// =========================================================================
// 8. Exit Final Completion & Unified Deprovisioning
// =========================================================================
router.post(
  '/requests/:id/complete',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['exit:admin']),
  exitController.completeExit
);

router.post(
  '/requests/:id/deprovision',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['deprovision:manage', 'exit:admin']),
  exitController.deprovisionAccess
);

export default router;
