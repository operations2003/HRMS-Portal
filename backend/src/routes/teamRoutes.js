import { Router } from 'express';
import { teamController } from '../controllers/teamController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateAssignManager } from '../validators/managerValidator.js';

const router = Router();

// Authentication required for all team endpoints
router.use(authenticate);

// =====================================================================
// 1. View Team Members & Manager's Team
// =====================================================================
router.get('/', teamController.getTeamMembers);
router.get('/members/:id', teamController.getTeamEmployeeDetails);

// =====================================================================
// 2. Team Summary
// =====================================================================
router.get('/summary', teamController.getTeamSummary);

// =====================================================================
// 3. Team Attendance Summary & Details
// =====================================================================
router.get('/attendance', teamController.getTeamAttendance);
router.get('/attendance/summary', teamController.getTeamAttendanceSummary);
router.get('/members/:id/attendance', teamController.getTeamMemberAttendance);

// =====================================================================
// 4. Team Leave Summary & Details
// =====================================================================
router.get('/leaves', teamController.getTeamLeaves);
router.get('/leaves/summary', teamController.getTeamLeaveSummary);
router.get('/members/:id/leaves', teamController.getTeamMemberLeaves);

// =====================================================================
// 5. Team Performance Summary & Details
// =====================================================================
router.get('/performance', teamController.getTeamPerformance);
router.get('/performance/summary', teamController.getTeamPerformanceSummary);
router.get('/members/:id/performance', teamController.getTeamMemberPerformance);

// =====================================================================
// 6. Team Assignment / Update (HR and Admin Scope Only)
// =====================================================================
router.patch(
  '/assign',
  authorize(['employee:write', 'org:write']),
  validate(validateAssignManager),
  teamController.assignTeamManager
);

export default router;
