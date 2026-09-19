import { Router } from 'express';
import { leaveController } from '../controllers/leaveController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateApplyLeave,
  validateRejectLeave,
  validateCancelLeave,
} from '../validators/leaveValidator.js';

const router = Router();

// All leave endpoints require valid JWT authentication
router.use(authenticate);

// 1. Leave metadata & balances
router.get('/types', authorize('leave:read'), leaveController.getLeaveTypes);
router.post(
  '/types',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']),
  leaveController.createLeaveType
);
router.get('/balances', authorize('leave:read'), leaveController.getMyBalances);
router.get(
  '/employee/:employeeId/balances',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']),
  leaveController.getEmployeeBalances
);
router.put(
  '/employee/:employeeId/balances',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']),
  leaveController.updateEmployeeBalances
);
router.post('/calculate', authorize('leave:read'), leaveController.calculateDuration);

// 2. Employee leave application & own history
router.post(
  '/apply',
  authorize('leave:write'),
  validate(validateApplyLeave),
  leaveController.applyLeave
);
router.get('/my', authorize('leave:read'), leaveController.getMyLeaves);

// 3. Team leaves (Manager scope)
router.get(
  '/team',
  requireRoles(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']),
  leaveController.getTeamLeaves
);

// 4. Organization leaves (HR / Admin scope)
router.get(
  '/organization',
  requireRoles(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']),
  leaveController.getOrgLeaves
);

// 5. Single leave details (with IDOR protection)
router.get('/:id', authorize('leave:read'), leaveController.getById);

// 6. Cancel leave (Employee own pending leave)
router.post(
  '/:id/cancel',
  authorize('leave:write'),
  validate(validateCancelLeave),
  leaveController.cancelLeave
);

// 7. Approve leave (Manager / HR / Admin)
router.post(
  '/:id/approve',
  authorize('leave:approve'),
  leaveController.approveLeave
);

// 8. Reject leave (Manager / HR / Admin)
router.post(
  '/:id/reject',
  authorize('leave:approve'),
  validate(validateRejectLeave),
  leaveController.rejectLeave
);

export default router;
