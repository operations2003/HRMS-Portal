import { payrollService } from '../services/payrollService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const payrollController = {
  // ==========================================
  // 1. PERIODS
  // ==========================================

  async listPeriods(req, res, next) {
    try {
      const periods = await payrollService.getPeriods(req.user, req.query);
      return sendSuccess(res, 'Payroll periods retrieved successfully.', periods);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getPeriodById(req, res, next) {
    try {
      const period = await payrollService.getPeriodById(req.user, req.params.id);
      return sendSuccess(res, 'Payroll period retrieved successfully.', period);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async createPeriod(req, res, next) {
    try {
      const created = await payrollService.createPeriod(req.user, req.body);
      return sendSuccess(res, 'Payroll period created successfully.', created, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async updatePeriod(req, res, next) {
    try {
      const updated = await payrollService.updatePeriod(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Payroll period updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async processPeriod(req, res, next) {
    try {
      const processed = await payrollService.processPeriod(req.user, req.params.id);
      return sendSuccess(res, 'Payroll period processed successfully.', processed);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async markPeriodPaid(req, res, next) {
    try {
      const paid = await payrollService.markPeriodPaid(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Payroll period finalized and marked as paid.', paid);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getPeriodSummary(req, res, next) {
    try {
      const summary = await payrollService.getPeriodSummary(req.user, req.params.id);
      return sendSuccess(res, 'Payroll period summary retrieved successfully.', summary);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  // ==========================================
  // 2. ORGANIZATION SUMMARY
  // ==========================================

  async getOrganizationSummary(req, res, next) {
    try {
      const summary = await payrollService.getOrganizationSummary(req.user);
      return sendSuccess(res, 'Organization payroll summary retrieved successfully.', summary);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  // ==========================================
  // 3. RECORDS
  // ==========================================

  async listRecords(req, res, next) {
    try {
      const records = await payrollService.getRecords(req.user, req.query);
      return sendSuccess(res, 'Payroll records retrieved successfully.', records);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getRecordById(req, res, next) {
    try {
      const record = await payrollService.getRecordById(req.user, req.params.id);
      return sendSuccess(res, 'Payroll record retrieved successfully.', record);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async createRecord(req, res, next) {
    try {
      const created = await payrollService.createRecord(req.user, req.body);
      return sendSuccess(res, 'Payroll record created successfully.', created, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async updateRecord(req, res, next) {
    try {
      const updated = await payrollService.updateRecord(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Payroll record updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async updateRecordStatus(req, res, next) {
    try {
      const updated = await payrollService.updateRecordStatus(
        req.user,
        req.params.id,
        req.body.status,
        req.body
      );
      return sendSuccess(res, 'Payroll record status updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  // ==========================================
  // 4. EMPLOYEE SELF-SERVICE
  // ==========================================

  async getMyRecords(req, res, next) {
    try {
      const records = await payrollService.getMyRecords(req.user, req.query);
      return sendSuccess(res, 'Your payroll records retrieved successfully.', records);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getMyRecordById(req, res, next) {
    try {
      const record = await payrollService.getMyRecordById(req.user, req.params.id);
      return sendSuccess(res, 'Your payroll record retrieved successfully.', record);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getMyPayslips(req, res, next) {
    try {
      const payslips = await payrollService.getMyPayslips(req.user, req.query);
      return sendSuccess(res, 'Your payslips retrieved successfully.', payslips);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getMyPayslipById(req, res, next) {
    try {
      const payslip = await payrollService.getMyPayslipById(req.user, req.params.id);
      return sendSuccess(res, 'Your payslip retrieved successfully.', payslip);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  // ==========================================
  // 5. PAYSLIP MANAGEMENT (HR / ADMIN / MANAGER)
  // ==========================================

  async listPayslips(req, res, next) {
    try {
      const payslips = await payrollService.getPayslips(req.user, req.query);
      return sendSuccess(res, 'Payslips retrieved successfully.', payslips);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getPayslipById(req, res, next) {
    try {
      const payslip = await payrollService.getPayslipById(req.user, req.params.id);
      return sendSuccess(res, 'Payslip retrieved successfully.', payslip);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async recordPayslipDownload(req, res, next) {
    try {
      const result = await payrollService.recordPayslipDownload(req.user, req.params.id);
      return sendSuccess(res, 'Payslip download recorded.', result);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};
