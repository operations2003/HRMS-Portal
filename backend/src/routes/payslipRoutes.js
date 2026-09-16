import { Router } from 'express';
import { payrollController } from '../controllers/payrollController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

// Authentication required for all payslip endpoints
router.use(authenticate);

// 1. Employee Own Payslip Retrieval (IDOR-protected)
router.get('/my', authorize('payslip:read'), payrollController.getMyPayslips);
router.get('/my/:id', authorize('payslip:read'), payrollController.getMyPayslipById);

// 2. Organization Payslip Management (HR / Admin / Manager)
router.get('/', authorize('payslip:read'), payrollController.listPayslips);
router.get('/:id', authorize('payslip:read'), payrollController.getPayslipById);

// 3. Track Payslip Download Count
router.post('/:id/download', authorize('payslip:read'), payrollController.recordPayslipDownload);

export default router;
