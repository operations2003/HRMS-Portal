import { Router } from 'express';
import { managerController } from '../controllers/managerController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateAssignManager } from '../validators/managerValidator.js';

const router = Router();

// All manager routes require authentication
router.use(authenticate);

// Team endpoints (Accessible by Managers, HR, and Admins)
router.get(
  '/team',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  managerController.getTeamMembers
);

router.get(
  '/team/summary',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  managerController.getTeamSummary
);

router.get(
  '/team/attendance',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  managerController.getTeamAttendance
);

router.get(
  '/team/leaves',
  requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']),
  managerController.getTeamLeaves
);

// Manager Assignment (HR and Admin only)
router.patch(
  '/assign',
  authorize(['employee:write', 'org:write']),
  validate(validateAssignManager),
  managerController.assignManager
);

export default router;
