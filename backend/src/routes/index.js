import { Router } from 'express';
import authRoutes from './authRoutes.js';
import orgRoutes from './orgRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import userRoutes from './userRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
import atsRoutes from './atsRoutes.js';
import onboardingRoutes from './onboardingRoutes.js';
import documentRoutes from './documentRoutes.js';
import attendanceRoutes from './attendanceRoutes.js';
import leaveRoutes from './leaveRoutes.js';
import departmentRoutes from './departmentRoutes.js';
import designationRoutes from './designationRoutes.js';
import helpdeskRoutes from './helpdeskRoutes.js';
import employeeRequestRoutes from './employeeRequestRoutes.js';
import notificationRoutes from './notificationRoutes.js';
import managerRoutes from './managerRoutes.js';
import teamRoutes from './teamRoutes.js';
import performanceRoutes from './performanceRoutes.js';
import workflowRoutes from './workflowRoutes.js';
import hrOperationsRoutes from './hrOperationsRoutes.js';
import exitRoutes from './exitRoutes.js';
import adminRoutes from './adminRoutes.js';
import probationRoutes from './probationRoutes.js';
import trainingRoutes from './trainingRoutes.js';
import engagementRoutes from './engagementRoutes.js';
import taskRoutes from './taskRoutes.js';
import expenseRoutes from './expenseRoutes.js';
import analyticsRoutes from './analyticsRoutes.js';
import payrollRoutes from './payrollRoutes.js';
import policyRoutes from './policyRoutes.js';
import { sendSuccess } from '../utils/apiResponse.js';
import { config } from '../config/index.js';

const router = Router();

// Health Check
router.get(['/', '/health', '/v1/health'], (req, res) => {
  return sendSuccess(res, 'HRMS Portal Backend API is running smoothly.', {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    diagnostics: {
      dbConfigured: Boolean(config.db.databaseUrl),
      jwtConfigured: Boolean(process.env.JWT_SECRET),
      clientUrl: config.clientUrl || '(default)',
      nodeEnv: config.nodeEnv,
    },
  });
});

// API v1 Modules (All 27 active non-payroll modules mounted)
router.use('/v1/auth', authRoutes);
router.use('/v1/organizations', orgRoutes);
router.use('/v1/employees', employeeRoutes);
router.use('/v1/users', userRoutes);
router.use('/v1/dashboard', dashboardRoutes);
router.use('/v1/integration/ats', atsRoutes);
router.use('/v1/onboarding', onboardingRoutes);
router.use('/v1/documents', documentRoutes);
router.use('/v1/attendance', attendanceRoutes);
router.use('/v1/leaves', leaveRoutes);
router.use('/v1/departments', departmentRoutes);
router.use('/v1/designations', designationRoutes);
router.use('/v1/helpdesk', helpdeskRoutes);
router.use('/v1/requests', employeeRequestRoutes);
router.use('/v1/notifications', notificationRoutes);
router.use('/v1/manager', managerRoutes);
router.use('/v1/team', teamRoutes);
router.use('/v1/performance', performanceRoutes);
router.use('/v1/workflows', workflowRoutes);
router.use('/v1/hr/operations', hrOperationsRoutes);
router.use('/v1/exit', exitRoutes);
router.use('/v1/admin', adminRoutes);

// IT Mapping v2.1 Modules
router.use('/v1/probation', probationRoutes);
router.use('/v1/training', trainingRoutes);
router.use('/v1/engagement', engagementRoutes);
router.use('/v1/tasks', taskRoutes);
router.use('/v1/expenses', expenseRoutes);
router.use('/v1/analytics', analyticsRoutes);
router.use('/v1/payroll', payrollRoutes);
router.use('/v1/policies', policyRoutes);

export default router;
