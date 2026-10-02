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
  '/all-balances',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin']),
  leaveController.getAllEmployeeBalances
);
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
router.get(
  '/team/stats',
  requireRoles(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']),
  leaveController.getTeamLeaveStats
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
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  authorize('leave:approve'),
  leaveController.approveLeave
);

// 8. Reject leave (Manager / HR / Admin)
router.post(
  '/:id/reject',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  authorize('leave:approve'),
  validate(validateRejectLeave),
  leaveController.rejectLeave
);

// 9. Edit leave request (Admin / HR / Reporting Manager)
router.post(
  '/update',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  (req, res, next) => {
    const id = req.body?.id || req.query?.id;
    if (id) req.params.id = id;
    return leaveController.updateLeave(req, res, next);
  }
);
router.put(
  '/:id',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  leaveController.updateLeave
);
router.patch(
  '/:id',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  leaveController.updateLeave
);
router.post(
  '/:id/edit',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  leaveController.updateLeave
);

// 10. Delete leave request (Admin / HR / Reporting Manager)
router.post(
  '/delete',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  (req, res, next) => {
    const id = req.body?.id || req.query?.id;
    if (id) req.params.id = id;
    return leaveController.deleteLeave(req, res, next);
  }
);
router.delete(
  '/:id',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  leaveController.deleteLeave
);
router.post(
  '/:id/delete',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager', 'Lead', 'TeamLead', 'Supervisor']),
  leaveController.deleteLeave
);

export default router;
