import { payrollRepository } from '../repositories/payrollRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { notificationService } from './notificationService.js';
import { pool } from '../config/db.js';
import { toCents, fromCents, addMoney, subtractMoney, sumMoney } from '../utils/financialUtils.js';

/**
 * Service Error Helper
 */
const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export const payrollService = {
  /**
   * Helper: Resolve logged-in user's employee record
   */
  async resolveEmployee(user) {
    const orgId = user.orgId || 'org-1';
    let employee = await employeeRepository.findByUserId(user.id, orgId);
    if (!employee && user.email) {
      employee = await employeeRepository.findByEmail(user.email, orgId);
    }
    if (!employee) {
      throw createError('No employee record associated with your user account.', 404);
    }
    return employee;
  },

  /**
   * Helper: Check whether user has HR or Admin privileges
   */
  isHrOrAdmin(user) {
    const role = (user?.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(role);
  },

  // ==========================================
  // 1. PERIODS
  // ==========================================

  async getPeriods(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    return await payrollRepository.findPeriods(orgId, filters);
  },

  async getPeriodById(user, id) {
    const orgId = user.orgId || 'org-1';
    const period = await payrollRepository.findPeriodById(id, orgId);
    if (!period) {
      throw createError('Payroll period not found.', 404);
    }
    return period;
  },

  async createPeriod(user, data) {
    const orgId = user.orgId || 'org-1';
    const existing = await payrollRepository.findPeriodByCode(data.periodCode, orgId);
    if (existing) {
      throw createError(`Payroll period with code "${data.periodCode.toUpperCase()}" already exists.`, 409);
    }

    return await payrollRepository.createPeriod({
      orgId,
      periodName: data.periodName,
      periodCode: data.periodCode,
      startDate: data.startDate,
      endDate: data.endDate,
      paymentDate: data.paymentDate,
      status: data.status || 'DRAFT',
    });
  },

  async updatePeriod(user, id, data) {
    const orgId = user.orgId || 'org-1';
    const period = await payrollRepository.findPeriodById(id, orgId);
    if (!period) {
      throw createError('Payroll period not found.', 404);
    }

    if (['PAID', 'CANCELLED'].includes(period.status) && data.status && data.status !== period.status) {
      throw createError(`Cannot change status of a ${period.status} payroll period.`, 400);
    }

    return await payrollRepository.updatePeriod(id, orgId, data);
  },

  // ==========================================
  // 2. PAYROLL RECORDS
  // ==========================================

  async getRecords(user, filters = {}) {
    const orgId = user.orgId || 'org-1';

    // Role-based scoping: non-HR/Admin users can only view their own records
    const isHrOrAdmin = ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'].includes(user.roleName);
    if (!isHrOrAdmin) {
      const emp = await this.resolveEmployee(user);
      filters.employeeId = emp.id;
    }

    return await payrollRepository.findRecords(orgId, filters);
  },

  async getRecordById(user, id) {
    const orgId = user.orgId || 'org-1';
    const record = await payrollRepository.findRecordById(id, orgId);
    if (!record) {
      throw createError('Payroll record not found.', 404);
    }

    // IDOR Protection: If employee, verify record ownership
    const isHrOrAdmin = ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'].includes(user.roleName);
    if (!isHrOrAdmin) {
      const emp = await this.resolveEmployee(user);
      if (record.employeeId !== emp.id) {
        throw createError('Access denied: You are not authorized to view this payroll record.', 403);
      }
    }

    return record;
  },

  async createRecord(user, data) {
    const orgId = user.orgId || 'org-1';

    // 1. Validate employee
    const employee = await employeeRepository.findById(data.employeeId);
    if (!employee || employee.orgId !== orgId) {
      throw createError('Employee not found in your organization.', 404);
    }

    // 2. Validate period
    const period = await payrollRepository.findPeriodById(data.periodId, orgId);
    if (!period) {
      throw createError('Payroll period not found.', 404);
    }
    if (['PAID', 'CANCELLED'].includes(period.status)) {
      throw createError(`Cannot add records to a ${period.status} payroll period.`, 400);
    }

    // 3. Prevent duplicate record
    const duplicate = await payrollRepository.findRecordByEmployeeAndPeriod(data.employeeId, data.periodId, orgId);
    if (duplicate) {
      throw createError('A payroll record already exists for this employee in the selected period.', 409);
    }

    // 4. Determine base salary & items
    const baseSalary = data.baseSalary !== undefined ? data.baseSalary : (employee.salary || 0);

    let items = Array.isArray(data.items) ? [...data.items] : [];
    // If no earnings item provided, create default basic salary item
    const hasEarnings = items.some((it) => it.itemType.toUpperCase() === 'EARNING');
    if (!hasEarnings && toCents(baseSalary) > 0) {
      items.unshift({
        itemType: 'EARNING',
        category: 'BASIC',
        name: 'Basic Salary',
        amount: fromCents(toCents(baseSalary)),
      });
    }

    // 5. Calculate financials using fixed-point integer cents
    const earningAmounts = items
      .filter((it) => it.itemType.toUpperCase() === 'EARNING')
      .map((it) => it.amount);
    const deductionAmounts = items
      .filter((it) => it.itemType.toUpperCase() === 'DEDUCTION')
      .map((it) => it.amount);

    const grossEarnings = sumMoney(earningAmounts);
    const totalDeductions = sumMoney(deductionAmounts);
    const netPayable = subtractMoney(grossEarnings, totalDeductions);

    if (toCents(netPayable) < 0) {
      throw createError('Total deductions cannot exceed gross earnings (net payable cannot be negative).', 400);
    }

    const workingDays = data.workingDays !== undefined ? data.workingDays : 30;
    const paidDays = data.paidDays !== undefined ? data.paidDays : workingDays;
    const lossOfPayDays = data.lossOfPayDays !== undefined ? data.lossOfPayDays : (workingDays - paidDays);

    return await payrollRepository.createRecordWithItems(
      {
        orgId,
        employeeId: data.employeeId,
        periodId: data.periodId,
        currency: data.currency || 'INR',
        baseSalary: fromCents(toCents(baseSalary)),
        grossEarnings,
        totalDeductions,
        netPayable,
        workingDays,
        paidDays,
        lossOfPayDays,
        status: data.status || 'DRAFT',
        paymentMethod: data.paymentMethod || 'BANK_TRANSFER',
        notes: data.notes || '',
      },
      items
    );
  },

  async updateRecord(user, id, data) {
    const orgId = user.orgId || 'org-1';
    const existing = await payrollRepository.findRecordById(id, orgId);
    if (!existing) {
      throw createError('Payroll record not found.', 404);
    }

    if (['PAID', 'CANCELLED'].includes(existing.status)) {
      throw createError(`Cannot modify a ${existing.status} payroll record.`, 400);
    }

    let items = Array.isArray(data.items) ? data.items : existing.items;

    // Recalculate financials using fixed-point arithmetic
    const baseSalary = data.baseSalary !== undefined ? data.baseSalary : existing.baseSalary;
    const earningAmounts = items
      .filter((it) => it.itemType.toUpperCase() === 'EARNING')
      .map((it) => it.amount);
    const deductionAmounts = items
      .filter((it) => it.itemType.toUpperCase() === 'DEDUCTION')
      .map((it) => it.amount);

    const grossEarnings = sumMoney(earningAmounts);
    const totalDeductions = sumMoney(deductionAmounts);
    const netPayable = subtractMoney(grossEarnings, totalDeductions);

    if (toCents(netPayable) < 0) {
      throw createError('Total deductions cannot exceed gross earnings (net payable cannot be negative).', 400);
    }

    const workingDays = data.workingDays !== undefined ? data.workingDays : existing.workingDays;
    const paidDays = data.paidDays !== undefined ? data.paidDays : existing.paidDays;
    const lossOfPayDays = data.lossOfPayDays !== undefined ? data.lossOfPayDays : existing.lossOfPayDays;

    return await payrollRepository.updateRecordWithItems(
      id,
      orgId,
      {
        baseSalary: fromCents(toCents(baseSalary)),
        grossEarnings,
        totalDeductions,
        netPayable,
        workingDays,
        paidDays,
        lossOfPayDays,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
      },
      items
    );
  },

  async updateRecordStatus(user, id, status, details = {}) {
    const orgId = user.orgId || 'org-1';
    const existing = await payrollRepository.findRecordById(id, orgId);
    if (!existing) {
      throw createError('Payroll record not found.', 404);
    }

    return await payrollRepository.updateRecordStatus(id, orgId, status, details);
  },

  // ==========================================
  // 3. PERIOD PROCESSING & PAYMENTS
  // ==========================================

  async processPeriod(user, periodId) {
    const orgId = user.orgId || 'org-1';
    const period = await payrollRepository.findPeriodById(periodId, orgId);
    if (!period) {
      throw createError('Payroll period not found.', 404);
    }

    if (period.status === 'PAID') {
      throw createError('Payroll period is already finalized and paid.', 400);
    }

    // Update records in this period from DRAFT to PROCESSED
    const records = await payrollRepository.findRecords(orgId, { periodId, status: 'DRAFT' });
    for (const rec of records) {
      await payrollRepository.updateRecordStatus(rec.id, orgId, 'PROCESSED');
    }

    // Mark period as PROCESSED
    const updatedPeriod = await payrollRepository.updatePeriod(periodId, orgId, { status: 'PROCESSED' });

    // Dispatch PAYROLL_PROCESSED notification
    try {
      const userRes = await pool.query(
        `SELECT DISTINCT e.user_id
         FROM payroll_records pr
         JOIN employees e ON e.id = pr.employee_id
         WHERE pr.period_id = $1 AND pr.org_id = $2 AND e.user_id IS NOT NULL`,
        [periodId, orgId]
      );
      const userIds = userRes.rows.map((r) => r.user_id);
      if (userIds.length > 0) {
        await notificationService.notifyPayrollProcessed({
          orgId,
          periodId: period.id,
          periodName: period.periodName,
          userIds,
        });
      }
    } catch (e) {
      // Non-blocking notification dispatch
    }

    return updatedPeriod;
  },

  async markPeriodPaid(user, periodId, paymentDetails = {}) {
    const orgId = user.orgId || 'org-1';
    const period = await payrollRepository.findPeriodById(periodId, orgId);
    if (!period) {
      throw createError('Payroll period not found.', 404);
    }

    if (period.status === 'PAID') {
      throw createError('Payroll period is already marked as paid.', 400);
    }

    // Update all records in this period to PAID
    const records = await payrollRepository.findRecords(orgId, { periodId });
    for (const rec of records) {
      if (rec.status !== 'PAID') {
        await payrollRepository.updateRecordStatus(rec.id, orgId, 'PAID', {
          paymentReference: paymentDetails.paymentReference || `PAY-${Date.now()}`,
        });
      }
    }

    // Update period status to PAID
    const updatedPeriod = await payrollRepository.updatePeriod(periodId, orgId, { status: 'PAID' });

    // Generate payslips for paid records
    const generatedPayslips = await payrollRepository.generatePayslipsForPeriod(periodId, orgId);

    // Dispatch PAYSLIP_AVAILABLE notifications
    try {
      for (const ps of generatedPayslips) {
        const empRes = await pool.query(
          `SELECT user_id FROM employees WHERE id = $1 AND org_id = $2`,
          [ps.employee_id, orgId]
        );
        const recipientUserId = empRes.rows[0]?.user_id;
        if (recipientUserId) {
          await notificationService.notifyPayslipAvailable({
            orgId,
            userId: recipientUserId,
            payslipNumber: ps.payslip_number,
            periodName: period.periodName,
            payslipId: ps.id,
          });
        }
      }
    } catch (e) {
      // Non-blocking notification dispatch
    }

    return updatedPeriod;
  },

  // ==========================================
  // 4. SUMMARIES
  // ==========================================

  async getOrganizationSummary(user) {
    const orgId = user.orgId || 'org-1';
    return await payrollRepository.getOrganizationPayrollSummary(orgId);
  },

  async getPeriodSummary(user, periodId) {
    const orgId = user.orgId || 'org-1';
    const summary = await payrollRepository.getPeriodSummary(periodId, orgId);
    if (!summary) {
      throw createError('Payroll period not found.', 404);
    }
    return summary;
  },

  // ==========================================
  // 5. EMPLOYEE SELF-SERVICE (IDOR PROTECTED)
  // ==========================================

  async getMyRecords(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    const employee = await this.resolveEmployee(user);
    return await payrollRepository.findEmployeeOwnRecords(employee.id, orgId, filters);
  },

  async getMyRecordById(user, id) {
    const orgId = user.orgId || 'org-1';
    const employee = await this.resolveEmployee(user);
    const record = await payrollRepository.findEmployeeOwnRecordById(id, employee.id, orgId);
    if (!record) {
      throw createError('Payroll record not found.', 404);
    }
    return record;
  },

  // ==========================================
  // 6. PAYSLIP MANAGEMENT & RETRIEVAL
  // ==========================================

  async getPayslips(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    const isHrAdmin = this.isHrOrAdmin(user);

    if (!isHrAdmin) {
      const employee = await this.resolveEmployee(user);
      return await payrollRepository.findPayslipsByEmployeeId(employee.id, orgId, filters);
    }

    return await payrollRepository.findPayslips(orgId, filters);
  },

  async getPayslipById(user, id) {
    const orgId = user.orgId || 'org-1';
    const isHrAdmin = this.isHrOrAdmin(user);

    let employeeId = null;
    if (!isHrAdmin) {
      const employee = await this.resolveEmployee(user);
      employeeId = employee.id;
    }

    const payslip = await payrollRepository.findPayslipById(id, orgId, employeeId);
    if (!payslip) {
      throw createError('Payslip not found or access denied.', 404);
    }

    return payslip;
  },

  async getMyPayslips(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    const employee = await this.resolveEmployee(user);
    return await payrollRepository.findPayslipsByEmployeeId(employee.id, orgId, filters);
  },

  async getMyPayslipById(user, id) {
    const orgId = user.orgId || 'org-1';
    const employee = await this.resolveEmployee(user);
    const payslip = await payrollRepository.findPayslipById(id, orgId, employee.id);
    if (!payslip) {
      throw createError('Payslip not found.', 404);
    }
    return payslip;
  },

  async recordPayslipDownload(user, id) {
    const orgId = user.orgId || 'org-1';
    await this.getPayslipById(user, id);
    const res = await payrollRepository.incrementPayslipDownload(id, orgId);
    return res;
  },
};
