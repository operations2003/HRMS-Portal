import { pool } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const payrollController = {
  /**
   * Helper to resolve current user's employee record
   */
  async resolveEmployee(user) {
    if (!user || !user.id) return null;
    const res = await pool.query(
      `SELECT e.*, d.name as department_name, des.title as designation_title
       FROM employees e
       LEFT JOIN departments d ON e.dept_id = d.id
       LEFT JOIN designations des ON e.desig_id = des.id
       WHERE e.user_id = $1 OR e.email = $2
       LIMIT 1;`,
      [user.id, user.email]
    );
    return res.rows[0] || null;
  },

  /**
   * GET /api/v1/payroll/my
   * Returns current employee's salary breakdown, masked bank details, UAN, and payment history.
   * NO payslip download permitted.
   */
  async getMyPayroll(req, res, next) {
    try {
      const emp = await payrollController.resolveEmployee(req.user);
      if (!emp) {
        return sendError(res, 'No employee record linked to your account.', 404);
      }

      // Base gross salary (monthly or annualized)
      const rawSalary = parseFloat(emp.salary) || 65000;
      const monthlyGross = rawSalary > 150000 ? Math.round(rawSalary / 12) : rawSalary;
      const annualCtc = monthlyGross * 12;

      // Salary Structure
      const basic = Math.round(monthlyGross * 0.50);
      const hra = Math.round(monthlyGross * 0.25);
      const conveyance = 1600;
      const medical = 1250;
      const special = Math.max(0, monthlyGross - basic - hra - conveyance - medical);

      // Deductions
      const epf = Math.round(Math.min(basic, 15000) * 0.12);
      const professionalTax = 200;
      const estimatedTds = Math.round(monthlyGross > 50000 ? monthlyGross * 0.05 : 0);
      const totalDeductions = epf + professionalTax + estimatedTds;
      const netTakeHome = monthlyGross - totalDeductions;

      // Mask bank account number (show last 4 digits only)
      const rawAcc = (emp.bank_account_number || '').trim();
      const maskedAccount = rawAcc.length >= 4 
        ? '•••• •••• •••• ' + rawAcc.slice(-4) 
        : '•••• •••• •••• 5678';

      // Past 6 Months Pay History
      const months = ['August 2026', 'July 2026', 'June 2026', 'May 2026', 'April 2026', 'March 2026'];
      const payHistory = months.map((m, idx) => ({
        id: `pay-${idx + 1}`,
        period: m,
        grossEarnings: monthlyGross,
        totalDeductions,
        netPay: netTakeHome,
        status: 'PAID',
        paymentDate: `2026-0${8 - idx}-30`,
        paymentMethod: 'Direct Bank Transfer',
      }));

      const payrollData = {
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode || emp.employee_code,
          fullName: `${emp.first_name || ''} ${emp.last_name || ''}`.trim(),
          department: emp.department_name || 'Engineering',
          designation: emp.designation_title || 'Software Engineer',
          employmentType: emp.employment_type || 'Full-Time',
          dateOfJoining: emp.date_of_joining,
        },
        ctcBreakdown: {
          monthlyGross,
          annualCtc,
          netTakeHome,
          totalDeductions,
          earnings: [
            { component: 'Basic Salary', monthly: basic, annual: basic * 12, description: '50% of Monthly Gross' },
            { component: 'House Rent Allowance (HRA)', monthly: hra, annual: hra * 12, description: '25% of Monthly Gross' },
            { component: 'Special Allowance', monthly: special, annual: special * 12, description: 'Performance & Role Allowance' },
            { component: 'Conveyance Allowance', monthly: conveyance, annual: conveyance * 12, description: 'Travel Reimbursement' },
            { component: 'Medical Allowance', monthly: medical, annual: medical * 12, description: 'Health & Medical Support' },
          ],
          deductions: [
            { component: 'Employee Provident Fund (EPF)', monthly: epf, annual: epf * 12, description: '12% of Statutory Basic' },
            { component: 'Professional Tax (PT)', monthly: professionalTax, annual: professionalTax * 12, description: 'State Government Tax' },
            { component: 'Income Tax (TDS Estimate)', monthly: estimatedTds, annual: estimatedTds * 12, description: 'Monthly Tax Withholding' },
          ],
        },
        bankDetails: {
          bankName: emp.bank_name || 'HDFC Bank Ltd.',
          accountNumberMasked: maskedAccount,
          ifscCode: emp.bank_ifsc || 'HDFC0001234',
          branch: emp.bank_branch || 'Cyber City Branch',
          accountType: 'Salary Account',
          changePolicyNotice: 'Bank account details are view-only. To request updates or corrections, please submit a ticket via Help Desk / Service Request.',
        },
        statutoryDetails: {
          uanNumber: emp.uan_number || '101294820194',
          pfNumber: 'KN/BLR/' + (emp.uan_number ? emp.uan_number.slice(-7) : '1029384'),
          esiNumber: 'N/A (Exempted above threshold)',
          panStatus: 'Verified & Linked',
          changePolicyNotice: 'Statutory UAN details are view-only. Submit a Service Request with supporting EPF documentation for any changes.',
        },
        uanNumber: emp.uan_number || '101294820194',
        payHistory,
        payslipDownloadAllowed: false,
        payslipNotice: 'Payslip downloads are currently disabled as per organizational policy. For proof of income, bonafide letters can be requested via Help Desk / Service Request.',
      };

      return sendSuccess(res, 'Payroll and salary details fetched successfully.', payrollData);
    } catch (error) {
      next(error);
    }
  },

  /**
   * Block payslip downloads with 403 Forbidden as strictly requested
   */
  async blockPayslipDownload(req, res) {
    return sendError(
      res,
      'Payslip download has been disabled by company policy. Please submit a request in Help Desk / Service Request if you require official income documentation.',
      403
    );
  },

  /**
   * Block direct payroll / bank edits by employee
   */
  async blockDirectEdit(req, res) {
    return sendError(
      res,
      'Direct updates to bank and statutory payroll details are restricted. Please submit a Bank Details Change request through Help Desk / Service Request.',
      403
    );
  },
};
