import { Router } from 'express';
import { payrollController } from '../controllers/payrollController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateCreatePeriod,
  validateUpdatePeriod,
  validateCreatePayrollRecord,
  validateUpdatePayrollRecord,
  validateUpdateRecordStatus,
} from '../validators/payrollValidator.js';

const router = Router();

// All payroll routes require authenticated session
router.use(authenticate);

// =====================================================================
// 1. Employee Own Payroll & Payslip Access (Self-Service with IDOR Guard)
// =====================================================================
router.get('/my/records', payrollController.getMyRecords);
router.get('/my/records/:id', payrollController.getMyRecordById);
router.get('/my/payslips', authorize('payslip:read'), payrollController.getMyPayslips);
router.get('/my/payslips/:id', authorize('payslip:read'), payrollController.getMyPayslipById);

// =====================================================================
// 2. Executive Payroll Summary (HR / Admin)
// =====================================================================
router.get('/summary', authorize('payroll:read'), payrollController.getOrganizationSummary);

// =====================================================================
// 3. Payroll Periods Management
// =====================================================================
router.get('/periods', authorize('payroll:read'), payrollController.listPeriods);
router.get('/periods/:id', authorize('payroll:read'), payrollController.getPeriodById);
router.get('/periods/:id/summary', authorize('payroll:read'), payrollController.getPeriodSummary);
router.post(
  '/periods',
  authorize('payroll:write'),
  validate(validateCreatePeriod),
  payrollController.createPeriod
);
router.put(
  '/periods/:id',
  authorize('payroll:write'),
  validate(validateUpdatePeriod),
  payrollController.updatePeriod
);
router.post(
  '/periods/:id/process',
  authorize('payroll:process'),
  payrollController.processPeriod
);
router.post(
  '/periods/:id/pay',
  authorize('payroll:process'),
  payrollController.markPeriodPaid
);

// =====================================================================
// 4. Employee Payroll Records Management (HR / Admin)
// =====================================================================
router.get('/records', authorize('payroll:read'), payrollController.listRecords);
router.get('/records/:id', authorize('payroll:read'), payrollController.getRecordById);
router.post(
  '/records',
  authorize('payroll:write'),
  validate(validateCreatePayrollRecord),
  payrollController.createRecord
);
router.put(
  '/records/:id',
  authorize('payroll:write'),
  validate(validateUpdatePayrollRecord),
  payrollController.updateRecord
);
router.patch(
  '/records/:id/status',
  authorize('payroll:process'),
  validate(validateUpdateRecordStatus),
  payrollController.updateRecordStatus
);

// =====================================================================
// 5. Payslip Retrieval & Management (HR / Admin / Manager)
// =====================================================================
router.get('/payslips', authorize('payslip:read'), payrollController.listPayslips);
router.get('/payslips/:id', authorize('payslip:read'), payrollController.getPayslipById);
router.post('/payslips/:id/download', authorize('payslip:read'), payrollController.recordPayslipDownload);

export default router;
