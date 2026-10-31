import { Router } from 'express';
import { publishedReportController } from '../controllers/publishedReportController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// All performance report routes require authentication
router.use(authenticate);

const reviewerRoles = [
  'Admin',
  'SuperAdmin',
  'OrgAdmin',
  'HR',
  'HRManager',
  'Manager',
  'LND',
  'LD',
  'Learning & Development',
];

// 2. Reviewer / Sender endpoints (Admin, HR, Manager, L&D)
router.delete(
  '/sent/:id',
  requireRoles(reviewerRoles),
  publishedReportController.deleteSentReport
);

// 1. Recipient endpoints (All authenticated employees)
router.get('/my', publishedReportController.getMyReports);
router.delete('/:id', publishedReportController.deleteMyReport);

// Reviewer actions continued
router.post(
  '/send',
  requireRoles(reviewerRoles),
  publishedReportController.sendReport
);

router.get(
  '/sent',
  requireRoles(reviewerRoles),
  publishedReportController.getSentReports
);

router.get(
  '/status/:employeeId',
  requireRoles(reviewerRoles),
  publishedReportController.getEmployeeStatus
);

router.put(
  '/:id',
  requireRoles(reviewerRoles),
  publishedReportController.updateReport
);

export default router;
