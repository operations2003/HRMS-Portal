import { Router } from 'express';
import { performanceController } from '../controllers/performanceController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateCreatePeriod,
  validateUpdatePeriod,
  validateCreateRecord,
  validateUpdateDraftRecord,
  validateManagerReview,
  validateReturnOrRejectRecord,
  validateGoal,
} from '../validators/performanceValidator.js';

const router = Router();

// All performance routes require authentication
router.use(authenticate);

// =========================================================================
// 1. Periods
// =========================================================================

router.get(
  '/periods',
  authorize(['performance:read', 'performance:manage']),
  performanceController.listPeriods
);

router.post(
  '/periods',
  authorize(['performance:manage']),
  validate(validateCreatePeriod),
  performanceController.createPeriod
);

router.get(
  '/periods/:id',
  authorize(['performance:read', 'performance:manage']),
  performanceController.getPeriodById
);

router.patch(
  '/periods/:id',
  authorize(['performance:manage']),
  validate(validateUpdatePeriod),
  performanceController.updatePeriod
);

// =========================================================================
// 2. Personal & Team Record Views
// =========================================================================

router.get(
  '/my',
  authorize(['performance:read', 'performance:write']),
  performanceController.getMyRecords
);

router.get(
  '/team',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['performance:read', 'performance:write']),
  performanceController.getTeamRecords
);

// =========================================================================
// 3. Appraisal Lifecycle Endpoints
// =========================================================================

router.get(
  '/records',
  authorize(['performance:read', 'performance:manage']),
  performanceController.listRecords
);

router.post(
  '/records',
  authorize(['performance:write']),
  validate(validateCreateRecord),
  performanceController.createRecord
);

router.get(
  '/records/:id',
  authorize(['performance:read', 'performance:write']),
  performanceController.getRecordById
);

router.put(
  '/records/:id',
  authorize(['performance:write']),
  validate(validateUpdateDraftRecord),
  performanceController.updateDraft
);

router.post(
  '/records/:id/submit',
  authorize(['performance:write']),
  performanceController.submitRecord
);

router.post(
  '/records/:id/manager-review',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  authorize(['performance:write', 'workflow:action']),
  validate(validateManagerReview),
  performanceController.managerReview
);

router.post(
  '/records/:id/hr-approve',
  authorize(['performance:manage', 'workflow:action']),
  performanceController.hrApprove
);

router.post(
  '/records/:id/return',
  authorize(['performance:write', 'workflow:action']),
  validate(validateReturnOrRejectRecord),
  performanceController.returnRecord
);

router.post(
  '/records/:id/reject',
  authorize(['performance:write', 'workflow:action']),
  validate(validateReturnOrRejectRecord),
  performanceController.rejectRecord
);

router.get(
  '/records/:id/history',
  authorize(['performance:read']),
  performanceController.getRecordHistory
);

// =========================================================================
// 4. Goals / KPIs
// =========================================================================

router.post(
  '/records/:id/goals',
  authorize(['performance:write']),
  validate(validateGoal),
  performanceController.addGoal
);

router.put(
  '/goals/:goalId',
  authorize(['performance:write']),
  validate(validateGoal),
  performanceController.updateGoal
);

router.delete(
  '/goals/:goalId',
  authorize(['performance:write']),
  performanceController.deleteGoal
);

export default router;
