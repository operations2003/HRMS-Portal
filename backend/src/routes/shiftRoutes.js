import { Router } from 'express';
import { shiftManagementController } from '../controllers/shiftManagementController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// Authentication required for all shift routes
router.use(authenticate);

// 1. Get eligible employees that caller can schedule
router.get(
  '/eligible-employees',
  authorize(['employee:read', 'attendance:read', 'team:read']),
  shiftManagementController.getEligibleEmployees
);

// 2. Get shift assignments / schedule for employee and date range
router.get(
  '/assignments',
  authorize(['employee:read', 'attendance:read', 'team:read']),
  shiftManagementController.getAssignments
);

// 3. Assign or edit shift timings for one or multiple specific dates
// Allowed for HR, Admin, and Managers
router.post(
  '/assign',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin', 'Manager', 'TeamLead']),
  shiftManagementController.assignShifts
);

// 4. Reset specific dates back to employee default shift
router.post(
  '/reset',
  requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin', 'Manager', 'TeamLead']),
  shiftManagementController.resetShifts
);

// 5. Shift change audit history
router.get(
  '/audit-history',
  authorize(['employee:read', 'attendance:read', 'team:read']),
  shiftManagementController.getAuditHistory
);

export default router;
