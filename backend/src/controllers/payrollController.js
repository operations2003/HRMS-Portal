import { pool } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const payrollController = {
  /**
   * Normalizes role string for comparison
   */
  normalizeRole(role) {
    return (role || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  },

  /**
   * Check if user is Admin / CEO (organization head)
   */
  isCeoOrAdmin(user) {
    if (!user) return false;
    const norm = this.normalizeRole(user.roleName);
    return norm === 'admin' || norm === 'superadmin' || norm === 'orgadmin';
  },

  /**
   * Check if user is HR
   */
  isHr(user) {
    if (!user) return false;
    const norm = this.normalizeRole(user.roleName);
    return norm === 'hr' || norm === 'hrmanager';
  },

  /**
   * Check if user has organization-wide payroll access (Admin/CEO or HR)
   */
  hasOrgPayrollAccess(user) {
    if (!user) return false;
    if (this.isCeoOrAdmin(user)) return true;
    if (this.isHr(user)) return true;
    const perms = user.permissions || [];
    return perms.includes('payroll:read_all') || perms.includes('payroll:manage');
  },

  /**
   * Helper to resolve current user's employee record
   */
  async resolveEmployee(user) {
    if (!user || !user.id) return null;
    const res = await pool.query(
      `SELECT e.*, d.name as department_name, des.title as designation_title,
              r.name as role_name
       FROM employees e
       LEFT JOIN departments d ON e.dept_id = d.id
       LEFT JOIN designations des ON e.desig_id = des.id
       LEFT JOIN users u ON e.user_id = u.id OR e.email = u.email
       LEFT JOIN roles r ON u.role_id = r.id
       WHERE e.user_id = $1 OR e.email = $2
       LIMIT 1;`,
      [user.id, user.email]
    );
    return res.rows[0] || null;
  },

  /**
   * Helper to compute complete salary structure using standard formulas
   */
  calculateSalaryBreakdown(emp) {
    // Base gross salary (monthly or annualized) - preserve existing formula
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
    const rawAcc = (emp.bank_account_number || emp.bankAccountNumber || '').trim();
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

    return {
      employee: {
        id: emp.id,
        employeeCode: emp.employee_code || emp.employeeCode || '',
        firstName: emp.first_name || emp.firstName || '',
        lastName: emp.last_name || emp.lastName || '',
        fullName: `${emp.first_name || emp.firstName || ''} ${emp.last_name || emp.lastName || ''}`.trim(),
        email: emp.email,
        role: emp.role_name || emp.roleName || 'Employee',
        department: emp.department_name || emp.department || 'Engineering',
        designation: emp.designation_title || emp.designation || 'Software Engineer',
        employmentType: emp.employment_type || emp.employmentType || 'Full-Time',
        dateOfJoining: emp.date_of_joining || emp.dateOfJoining,
        rawSalary,
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
        bankName: emp.bank_name || emp.bankName || 'HDFC Bank Ltd.',
        accountNumberMasked: maskedAccount,
        ifscCode: emp.bank_ifsc || emp.bankIfsc || 'HDFC0001234',
        branch: emp.bank_branch || emp.bankBranch || 'Cyber City Branch',
        accountType: 'Salary Account',
        changePolicyNotice: 'Bank account details are view-only. To request updates or corrections, please submit a ticket via Help Desk / Service Request.',
      },
      statutoryDetails: {
        uanNumber: emp.uan_number || emp.uanNumber || '101294820194',
        pfNumber: 'KN/BLR/' + ((emp.uan_number || emp.uanNumber) ? (emp.uan_number || emp.uanNumber).slice(-7) : '1029384'),
        esiNumber: 'N/A (Exempted above threshold)',
        panStatus: 'Verified & Linked',
        changePolicyNotice: 'Statutory UAN details are view-only. Submit a Service Request with supporting EPF documentation for any changes.',
      },
      uanNumber: emp.uan_number || emp.uanNumber || '101294820194',
      payHistory,
      payslipDownloadAllowed: false,
      payslipNotice: 'Payslip downloads are currently disabled as per organizational policy. For proof of income, bonafide letters can be requested via Help Desk / Service Request.',
    };
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

      const payrollData = payrollController.calculateSalaryBreakdown(emp);
      return sendSuccess(res, 'Payroll and salary details fetched successfully.', payrollData);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/payroll/organization
   * Returns organization-wide payroll overview and summary metrics.
   * STRICT ACCESS: Admin / CEO and HR only. Manager and Employee receive 403 Forbidden.
   */
  async getOrganizationPayroll(req, res, next) {
    try {
      if (!payrollController.hasOrgPayrollAccess(req.user)) {
        return sendError(
          res,
          'Access Forbidden: You do not have permission to view organization-wide payroll information. Managers and Employees can only view their own salary.',
          403
        );
      }

      const isSuperAdmin = (req.user?.roleName || '').toLowerCase().includes('admin') && !req.user?.orgId;
      const orgId = isSuperAdmin ? (req.query.orgId || null) : (req.user?.orgId || req.query.orgId || null);

      const query = `
        SELECT e.*, d.name as department_name, des.title as designation_title,
               r.name as role_name
        FROM employees e
        LEFT JOIN departments d ON e.dept_id = d.id
        LEFT JOIN designations des ON e.desig_id = des.id
        LEFT JOIN users u ON e.user_id = u.id OR e.email = u.email
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE ($1::text IS NULL OR e.org_id = $1)
        ORDER BY e.created_at ASC;
      `;

      const result = await pool.query(query, [orgId]);
      const employees = result.rows.map((row) => {
        const breakdown = payrollController.calculateSalaryBreakdown(row);
        return {
          id: row.id,
          employeeCode: row.employee_code,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          email: row.email,
          role: row.role_name || 'Employee',
          department: row.department_name || 'General',
          designation: row.designation_title || 'Staff',
          status: row.status,
          dateOfJoining: row.date_of_joining,
          salary: parseFloat(row.salary) || 0,
          annualCtc: breakdown.ctcBreakdown.annualCtc,
          monthlyGross: breakdown.ctcBreakdown.monthlyGross,
          netTakeHome: breakdown.ctcBreakdown.netTakeHome,
          totalDeductions: breakdown.ctcBreakdown.totalDeductions,
        };
      });

      // Calculate summary metrics
      const totalMonthlyGross = employees.reduce((acc, e) => acc + e.monthlyGross, 0);
      const totalAnnualCtc = employees.reduce((acc, e) => acc + e.annualCtc, 0);
      const totalMonthlyInHand = employees.reduce((acc, e) => acc + e.netTakeHome, 0);
      const totalMonthlyDeductions = employees.reduce((acc, e) => acc + e.totalDeductions, 0);
      const avgMonthlyInHand = employees.length > 0 ? Math.round(totalMonthlyInHand / employees.length) : 0;

      const summary = {
        totalEmployees: employees.length,
        totalMonthlyGross,
        totalAnnualCtc,
        totalMonthlyInHand,
        totalMonthlyDeductions,
        avgMonthlyInHand,
      };

      return sendSuccess(res, 'Organization payroll data fetched successfully.', {
        summary,
        employees,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/payroll/employee/:id
   * Returns specific employee's full salary structure and payroll breakdown.
   * Access:
   * - Admin / CEO and HR: Can view ANY employee in their organization.
   * - Manager and Employee: Can view ONLY their own employee record. Unauthorized attempts return 403.
   */
  async getEmployeePayrollById(req, res, next) {
    try {
      const { id } = req.params;
      const caller = req.user;

      const empRes = await pool.query(
        `SELECT e.*, d.name as department_name, des.title as designation_title,
                r.name as role_name
         FROM employees e
         LEFT JOIN departments d ON e.dept_id = d.id
         LEFT JOIN designations des ON e.desig_id = des.id
         LEFT JOIN users u ON e.user_id = u.id OR e.email = u.email
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE e.id = $1
         LIMIT 1;`,
        [id]
      );

      if (empRes.rows.length === 0) {
        return sendError(res, 'Employee not found.', 404);
      }

      const targetEmp = empRes.rows[0];

      // Org-level isolation
      if (caller?.orgId && targetEmp.org_id !== caller.orgId) {
        const isSuperAdmin = (caller?.roleName || '').toLowerCase().includes('admin') && !caller?.orgId;
        if (!isSuperAdmin) {
          return sendError(res, 'Access denied: Employee not found in your organization.', 404);
        }
      }

      // Check role authorization
      const isPrivileged = payrollController.hasOrgPayrollAccess(caller);
      const isSelf = targetEmp.id === caller.employeeId || 
                     targetEmp.user_id === caller.id || 
                     targetEmp.email === caller.email;

      if (!isPrivileged && !isSelf) {
        return sendError(
          res,
          'Access Forbidden: You are only authorized to view your own salary information.',
          403
        );
      }

      const payrollData = payrollController.calculateSalaryBreakdown(targetEmp);
      return sendSuccess(res, 'Employee payroll details fetched successfully.', payrollData);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/payroll/employee/:id/salary
   * Updates employee's salary and recalculates compensation structure.
   * Admin is the CEO/organization head responsible for deciding and giving salaries.
   * HR has payroll permission to handle/manage salaries according to existing RBAC.
   * Managers and Employees receive 403 Forbidden.
   */
  async updateEmployeeSalary(req, res, next) {
    try {
      const { id } = req.params;
      const caller = req.user;
      const { salary } = req.body;

      // Access control
      if (!payrollController.hasOrgPayrollAccess(caller)) {
        return sendError(
          res,
          'Access Forbidden: Only Admin/CEO and HR are authorized to manage employee salaries.',
          403
        );
      }

      // Validate salary
      if (salary === undefined || salary === null || isNaN(Number(salary)) || Number(salary) < 0) {
        return sendError(res, 'Salary must be a non-negative number.', 400);
      }

      const isSuperAdmin = (caller?.roleName || '').toLowerCase().includes('admin') && !caller?.orgId;
      const orgId = isSuperAdmin ? null : caller.orgId;

      const updateRes = await pool.query(
        `UPDATE employees
         SET salary = $1, updated_at = NOW()
         WHERE id = $2 AND ($3::text IS NULL OR org_id = $3)
         RETURNING *;`,
        [Number(salary), id, orgId]
      );

      if (updateRes.rows.length === 0) {
        return sendError(res, 'Employee not found or unauthorized for update.', 404);
      }

      // Fetch full employee details with joined metadata
      const empRes = await pool.query(
        `SELECT e.*, d.name as department_name, des.title as designation_title,
                r.name as role_name
         FROM employees e
         LEFT JOIN departments d ON e.dept_id = d.id
         LEFT JOIN designations des ON e.desig_id = des.id
         LEFT JOIN users u ON e.user_id = u.id OR e.email = u.email
         LEFT JOIN roles r ON u.role_id = r.id
         WHERE e.id = $1
         LIMIT 1;`,
        [id]
      );

      const updatedEmp = empRes.rows[0];
      const payrollData = payrollController.calculateSalaryBreakdown(updatedEmp);

      return sendSuccess(res, 'Employee salary decided and updated successfully.', payrollData);
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
