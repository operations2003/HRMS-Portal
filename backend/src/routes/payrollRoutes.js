import { Router } from 'express';
import { payrollController } from '../controllers/payrollController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

// All payroll routes require authentication
router.use(authenticate);

// 1. My Payroll Overview (salary, CTC breakdown, masked bank, UAN, pay history)
router.get('/my', payrollController.getMyPayroll);

// 2. Organization Payroll Overview (Admin / CEO and HR only)
router.get('/organization', authorize(['payroll:read_all']), payrollController.getOrganizationPayroll);

// 3. Employee Payroll by ID (Admin/CEO & HR can view any employee; Manager & Employee can view only own)
router.get('/employee/:id', payrollController.getEmployeePayrollById);

// 4. Update / Decide Employee Salary (Admin/CEO deciding salaries, and HR)
router.put('/employee/:id/salary', authorize(['payroll:write', 'employee:write']), payrollController.updateEmployeeSalary);
router.patch('/employee/:id/salary', authorize(['payroll:write', 'employee:write']), payrollController.updateEmployeeSalary);

// 5. Pay / Disburse Employee Salary (Admin / CEO and HR)
router.post('/employee/:id/pay', authorize(['payroll:write', 'employee:write']), payrollController.payEmployeeSalary);
router.post('/disburse-all', authorize(['payroll:write', 'employee:write']), payrollController.disburseAllPayroll);

// 5. Reject all payslip download attempts explicitly with 403 Forbidden
router.get('/my/payslip/:id/download', payrollController.blockPayslipDownload);
router.get('/payslips/:id/download', payrollController.blockPayslipDownload);
router.get('/payslips/download', payrollController.blockPayslipDownload);
router.get('/download/:id', payrollController.blockPayslipDownload);
router.all('*/download*', payrollController.blockPayslipDownload);

// 6. Reject direct updates to bank / payroll with 403 Forbidden
router.put('/bank-details', payrollController.blockDirectEdit);
router.patch('/bank-details', payrollController.blockDirectEdit);
router.post('/bank-details', payrollController.blockDirectEdit);

export default router;
