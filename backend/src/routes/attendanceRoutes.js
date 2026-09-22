import { Router } from 'express';
import { attendanceController } from '../controllers/attendanceController.js';
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

// 4. Manager / team attendance API
router.get(
  '/team',
  requireRoles(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']),
  attendanceController.getTeamAttendance
);

// 5. HR authorized organization attendance API
router.get(
  '/organization',
  requireRoles(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']),
  attendanceController.getOrgAttendance
);

// 6. Attendance details API (with organizational & IDOR protection)
router.get(
  '/:id',
  authorize('attendance:read'),
  attendanceController.getById
);

// 7. Regularize attendance API (Admin, HR, Manager)
router.put(
  '/:id/regularize',
  authorize('attendance:regularize'),
  validate(validateRegularize),
  attendanceController.regularize
);

// 8. Add Shift Remark (Emergency or OT for 10h+ post-shift work) (Admin, HR, Manager)
router.put(
  '/:id/remark',
  requireRoles(['Manager', 'HR', 'Admin', 'SuperAdmin', 'HRManager', 'OrgAdmin']),
  validate(validateShiftRemark),
  attendanceController.addShiftRemark
);

export default router;

