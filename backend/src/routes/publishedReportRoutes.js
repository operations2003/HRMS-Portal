import { Router } from 'express';
import { publishedReportController } from '../controllers/publishedReportController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// All performance report routes require authentication
router.use(authenticate);

// 1. Recipient endpoints (All authenticated employees)
router.get('/my', publishedReportController.getMyReports);
router.delete('/:id', publishedReportController.deleteMyReport);

// 2. Reviewer / Sender endpoints (Admin, HR, Manager)
router.post(
  '/send',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'HR', 'HRManager', 'Manager']),
  publishedReportController.sendReport
);

router.get(
  '/sent',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'HR', 'HRManager', 'Manager']),
  publishedReportController.getSentReports
);

router.get(
  '/status/:employeeId',
  requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin', 'HR', 'HRManager', 'Manager']),
  publishedReportController.getEmployeeStatus
);

export default router;
