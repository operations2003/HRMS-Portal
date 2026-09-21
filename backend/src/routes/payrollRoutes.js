import { Router } from 'express';
import { payrollController } from '../controllers/payrollController.js';
import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.use(authenticate);

// 1. My Payroll Overview (salary, CTC breakdown, masked bank, UAN, pay history)
router.get('/my', payrollController.getMyPayroll);

// 2. Reject all payslip download attempts explicitly with 403 Forbidden
router.get('/my/payslip/:id/download', payrollController.blockPayslipDownload);
router.get('/payslips/:id/download', payrollController.blockPayslipDownload);
router.get('/payslips/download', payrollController.blockPayslipDownload);
router.get('/download/:id', payrollController.blockPayslipDownload);
router.all('*/download*', payrollController.blockPayslipDownload);

// 3. Reject direct updates to bank / payroll with 403 Forbidden
router.put('/bank-details', payrollController.blockDirectEdit);
router.patch('/bank-details', payrollController.blockDirectEdit);
router.post('/bank-details', payrollController.blockDirectEdit);

export default router;
