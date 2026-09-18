import { Router } from 'express';
import { hrOperationsController } from '../controllers/hrOperationsController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// All HR Operations routes require authentication and HR/Admin roles
router.use(authenticate);
router.use(requireRoles(['HR', 'HRManager', 'Admin', 'SuperAdmin', 'OrgAdmin']));

// Consolidated workforce & operations overview
router.get('/overview', hrOperationsController.getOverview);

// Cross-module unified pending approval queue
router.get('/approval-queue', hrOperationsController.getApprovalQueue);

// Broadcast announcement to workforce
router.post('/broadcast', hrOperationsController.broadcastAnnouncement);

// Teams and manager operational overviews
router.get('/teams', hrOperationsController.getTeams);
router.get('/teams/:managerId', hrOperationsController.getTeamByManager);

// Organization operational summaries
router.get('/performance/summary', hrOperationsController.getPerformanceSummary);
router.get('/attendance/summary', hrOperationsController.getAttendanceSummary);
router.get('/leaves/summary', hrOperationsController.getLeaveSummary);
router.get('/exit/summary', hrOperationsController.getExitSummary);

// Individual employee operational 360 profile
router.get('/employees/:id', hrOperationsController.getEmployeeProfile);

export default router;

