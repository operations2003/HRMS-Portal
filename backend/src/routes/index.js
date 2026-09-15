import { Router } from 'express';
import authRoutes from './authRoutes.js';
import orgRoutes from './orgRoutes.js';
import employeeRoutes from './employeeRoutes.js';
import userRoutes from './userRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';
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

export default router;
