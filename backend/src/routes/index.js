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
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

// Health Check
router.get('/health', (req, res) => {
  return sendSuccess(res, 'HRMS Portal Backend API is running smoothly.', {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API v1 Modules
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

export default router;
