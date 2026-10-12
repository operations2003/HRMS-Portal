import { Router } from 'express';
import { dailyReportController } from '../controllers/dailyReportController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

// All daily report routes require authentication
router.use(authenticate);

// 1. Submit or update today's daily work report
router.post('/', dailyReportController.submitReport);

// 2. Get my report for today
router.get('/my/today', dailyReportController.getMyTodayReport);

// 3. Get my past reports history
router.get('/my', dailyReportController.getMyReports);

// 4. Get team / organization reports (Manager, HR, Admin)
router.get('/team', dailyReportController.getTeamReports);

// 5. Get summary & compliance rate for a date
router.get('/summary', dailyReportController.getSummary);

// 6. Get pending employees who have not submitted daily report for a date
router.get('/pending', dailyReportController.getPendingEmployees);

// 7. Send reminder notification(s) to pending employees
router.post('/remind', dailyReportController.sendReminder);

// 8. Acknowledge and add feedback to a report
router.post('/:id/feedback', dailyReportController.addFeedback);

export default router;
