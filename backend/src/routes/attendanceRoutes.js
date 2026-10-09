import { Router } from 'express';
import { attendanceController } from '../controllers/attendanceController.js';
import { overtimeController } from '../controllers/overtimeController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateCheckIn,
  validateCheckOut,
  validateRegularize,
  validateShiftRemark,
} from '../validators/attendanceValidator.js';

const router = Router();

// All attendance routes require JWT authentication
router.use(authenticate);

// 1. Employee check-in API
router.post(
  '/check-in',
  authorize('attendance:write'),
  validate(validateCheckIn),
  attendanceController.checkIn
);

// 2. Employee check-out API
router.post(
  '/check-out',
  authorize('attendance:write'),
  validate(validateCheckOut),
  attendanceController.checkOut
);

// 2b. Employee break pause API
router.post(
  '/pause-break',
  authorize('attendance:write'),
  attendanceController.pauseBreak
);

// 2c. Employee break resume API
router.post(
  '/resume-break',
  authorize('attendance:write'),
  attendanceController.resumeBreak
);

// 3. Employee own attendance history API
router.get(
  '/my',
  authorize('attendance:read'),
  attendanceController.getMyAttendance
);

// 3a. Employee today attendance API
router.get(
  '/my/today',
  authorize('attendance:read'),
  attendanceController.getMyTodayAttendance
);

// 3b. Overtime APIs (Separated from regular attendance)
router.post(
  '/overtime/login',
  authorize('attendance:write'),
  overtimeController.loginOvertime
);

router.post(
  '/overtime/logout',
  authorize('attendance:write'),
  overtimeController.logoutOvertime
);

router.get(
  '/overtime/today',
  authorize('attendance:read'),
  overtimeController.getTodayOvertime
);

router.get(
  '/overtime/history',
  authorize('attendance:read'),
  overtimeController.getOvertimeHistory
);

// 3c. Shift grace auto-logout sweep API
router.post(
  '/cron/auto-logout',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'HR', 'HRManager']),
  overtimeController.triggerAutoLogoutSweep
);

// 4. Team attendance API (HR, Admin, and Manager)
router.get(
  '/team',
  requireRoles(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin', 'Manager']),
  attendanceController.getTeamAttendance
);

// 5a. Organization Attendance Analytics (Trend & Status Distribution for Admin, HR & Manager)
router.get(
  '/organization/analytics',
  requireRoles(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin', 'Manager']),
  attendanceController.getOrgAnalytics
);

// 5b. HR, Admin & Manager authorized organization attendance records API
router.get(
  '/organization',
  requireRoles(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin', 'Manager']),
  attendanceController.getOrgAttendance
);

// 6. Attendance details API (with organizational & IDOR protection)
router.get(
  '/:id',
  authorize('attendance:read'),
  attendanceController.getById
);

// 7. Regularize / Edit timing attendance API (Admin, HR, Manager)
router.put(
  '/:id/regularize',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'Manager', 'OrgAdmin']),
  validate(validateRegularize),
  attendanceController.regularize
);

// 8. Add Shift Remark (Tag as OT, Mistake, or Emergency) (HR, Admin, and Manager)
router.put(
  '/:id/remark',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager']),
  validate(validateShiftRemark),
  attendanceController.addShiftRemark
);

// 9. Synchronize daily absences (mark employees who didn't log in as ABSENT)
router.post(
  '/sync-absences',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager']),
  attendanceController.syncDailyAbsences
);

// 10. Get leave options & balances for converting an absent record
router.get(
  '/:id/absent-leave-options',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager']),
  attendanceController.getAbsentLeaveOptions
);

// 11. Convert an absent attendance record into an approved leave and deduct from bucket
router.post(
  '/:id/convert-to-leave',
  requireRoles(['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin', 'Manager']),
  attendanceController.convertAbsenceToLeave
);

export default router;

