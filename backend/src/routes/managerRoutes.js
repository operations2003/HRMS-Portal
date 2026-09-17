import { Router } from 'express';
import { managerController } from '../controllers/managerController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateAssignManager } from '../validators/managerValidator.js';

const router = Router();

// All manager routes require authentication
router.use(authenticate);

// Role gate: Only Managers, HR, and Admins can access manager portal functionality
const managerRoleGate = requireRoles(['Manager', 'HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']);

// =====================================================================
// 1. Manager Profile & Dashboard Overview
// =====================================================================
router.get('/dashboard', managerRoleGate, managerController.getDashboard);
router.get('/profile', managerRoleGate, managerController.getDashboard);

// =====================================================================
// 2. Pending Manager Approvals (Consolidated Action Queue)
// =====================================================================
router.get('/approvals', managerRoleGate, managerController.getPendingApprovals);

// =====================================================================
// 3. Assigned Team Members & Member Profiles (Team Scope Gated)
// =====================================================================
router.get('/team', managerRoleGate, managerController.getTeamMembers);
router.get('/team/members/:employeeId', managerRoleGate, managerController.getTeamMemberById);

// =====================================================================
// 4. Team Employee Summary
// =====================================================================
router.get('/team/summary', managerRoleGate, managerController.getTeamSummary);

// =====================================================================
// 5. Team Attendance Summary & Detail (Team Scope Gated)
// =====================================================================
router.get('/team/attendance', managerRoleGate, managerController.getTeamAttendance);
router.get('/team/attendance/summary', managerRoleGate, managerController.getTeamAttendanceSummary);
router.get('/team/members/:employeeId/attendance', managerRoleGate, managerController.getTeamMemberAttendance);

// =====================================================================
// 6. Team Leave Information & Approvals (Team Scope Gated)
// =====================================================================
router.get('/team/leaves', managerRoleGate, managerController.getTeamLeaves);
router.get('/team/members/:employeeId/leaves', managerRoleGate, managerController.getTeamMemberLeaves);
router.post('/team/leaves/:leaveId/approve', managerRoleGate, managerController.approveTeamLeave);
router.post('/team/leaves/:leaveId/reject', managerRoleGate, managerController.rejectTeamLeave);

// =====================================================================
// 7. Team Performance Information (Team Scope Gated)
// =====================================================================
router.get('/team/performance', managerRoleGate, managerController.getTeamPerformance);
router.get('/team/members/:employeeId/performance', managerRoleGate, managerController.getTeamMemberPerformance);

// =====================================================================
// 8. Manager Assignment (HR & Admin Only)
// =====================================================================
router.patch(
  '/assign',
  authorize(['employee:write', 'org:write']),
  validate(validateAssignManager),
  managerController.assignManager
);

export default router;
