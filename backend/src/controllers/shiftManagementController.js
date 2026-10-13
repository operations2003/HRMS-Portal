import { shiftManagementService } from '../services/shiftManagementService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const shiftManagementController = {
  /**
   * GET /api/v1/shifts/eligible-employees
   * List employees caller is authorized to manage
   */
  async getEligibleEmployees(req, res, next) {
    try {
      const employees = await shiftManagementService.getEligibleEmployees(req.user);
      return sendSuccess(res, 'Eligible employees retrieved.', employees);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/shifts/assignments (and /api/v1/roster/assignments)
   * Get shift schedule and overrides for employee and date range
   */
  async getAssignments(req, res, next) {
    try {
      const { employeeId, startDate, endDate, month, year, departmentId } = req.query;
      const result = await shiftManagementService.getEmployeeShifts(req.user, {
        employeeId,
        startDate,
        endDate,
        month,
        year,
        departmentId,
      });
      return sendSuccess(res, 'Shift assignments retrieved successfully.', result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/shifts/assign
   * Assign or edit shift timings for one or multiple specific dates
   */
  async assignShifts(req, res, next) {
    try {
      const { employeeId, dates, shiftType, shiftLabel, shiftStartTime, shiftEndTime, notes } = req.body;

      if (!employeeId) {
        return sendError(res, 'Employee ID is required.', 400);
      }
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return sendError(res, 'At least one date must be provided in the dates array.', 400);
      }

      const result = await shiftManagementService.assignShiftsForDates(req.user, {
        employeeId,
        dates,
        shiftType: shiftType || 'SHIFT',
        shiftLabel,
        shiftStartTime,
        shiftEndTime,
        notes,
      });

      return sendSuccess(res, result.message, result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/shifts/reset
   * Reset specific dates back to standard default shift
   */
  async resetShifts(req, res, next) {
    try {
      const { employeeId, dates } = req.body;

      if (!employeeId) {
        return sendError(res, 'Employee ID is required.', 400);
      }
      if (!dates || !Array.isArray(dates) || dates.length === 0) {
        return sendError(res, 'At least one date must be provided in the dates array.', 400);
      }

      const result = await shiftManagementService.resetShiftsToDefault(req.user, {
        employeeId,
        dates,
      });

      return sendSuccess(res, result.message, result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/shifts/audit-history
   * Get shift change history and audit trail
   */
  async getAuditHistory(req, res, next) {
    try {
      const { employeeId, limit = 50, page = 1 } = req.query;
      const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
      const result = await shiftManagementService.getAuditHistory(req.user, {
        employeeId,
        limit: parseInt(limit, 10),
        offset,
      });

      return sendSuccess(res, 'Shift change history retrieved.', result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },
};

export default shiftManagementController;
