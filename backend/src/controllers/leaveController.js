import { leaveService } from '../services/leaveService.js';
import { leaveRepository } from '../repositories/leaveRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const leaveController = {
  /**
   * GET /api/v1/leaves/types
   * List available leave types
   */
  async getLeaveTypes(req, res, next) {
    try {
      const isAll = req.query.all === 'true';
      const isForSelf = req.query.forSelf === 'true';
      const types = await leaveService.getLeaveTypes(req.user, { all: isAll, gender: req.query.gender, forSelf: isForSelf });
      return sendSuccess(res, 'Leave types fetched successfully.', types);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/leaves/types
   * Create a new custom leave type (Admin/HR)
   */
  async createLeaveType(req, res, next) {
    try {
      const newType = await leaveService.createLeaveType(req.user, req.body);
      return sendSuccess(res, 'Leave type created successfully.', newType, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/balances
   * List current employee's leave balances
   */
  async getMyBalances(req, res, next) {
    try {
      const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
      const isAll = req.query.all === 'true';
      const balances = await leaveService.getMyBalances(req.user, year, { all: isAll });
      return sendSuccess(res, 'Leave balances fetched successfully.', balances);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/all-balances
   * Fetch leave balances for all active employees (Admin / HR)
   */
  async getAllEmployeeBalances(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
      const balances = await leaveRepository.getAllEmployeesBalances(orgId, year);
      return sendSuccess(res, 'All employee leave balances fetched successfully.', balances);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/employee/:employeeId/balances
   * Fetch leave balances for a specific employee (Admin / HR)
   */
  async getEmployeeBalances(req, res, next) {
    try {
      const { employeeId } = req.params;
      const year = req.query.year ? parseInt(req.query.year, 10) : new Date().getFullYear();
      let balances = await leaveRepository.getLeaveBalances(employeeId, year);
      if (balances.length === 0) {
        const emp = await employeeRepository.findById(employeeId);
        if (emp) {
          balances = await leaveRepository.initializeBalancesForEmployee(employeeId, emp.orgId, year);
        }
      }
      return sendSuccess(res, 'Employee leave balances fetched successfully.', balances);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/leaves/employee/:employeeId/balances
   * Update or set custom leave allocations for a specific employee (Admin / HR)
   */
  async updateEmployeeBalances(req, res, next) {
    try {
      const { employeeId } = req.params;
      const year = req.body.year ? parseInt(req.body.year, 10) : new Date().getFullYear();
      const allocations = req.body.allocations || req.body;
      const emp = await employeeRepository.findById(employeeId);
      if (!emp) {
        return sendError(res, `Employee with ID '${employeeId}' not found.`, 404);
      }
      const updated = await leaveRepository.setEmployeeLeaveAllocations(employeeId, emp.orgId, year, allocations);
      return sendSuccess(res, 'Employee leave allocations updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/leaves/calculate
   * Preview calculated leave duration (working days, weekends, holidays)
   */
  async calculateDuration(req, res, next) {
    try {
      const result = await leaveService.calculateDuration(req.user, req.body);
      return sendSuccess(res, 'Leave duration calculated successfully.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/leaves/apply
   * Apply for leave
   */
  async applyLeave(req, res, next) {
    try {
      const record = await leaveService.applyLeave(req.user, req.body);
      return sendSuccess(res, 'Leave request submitted successfully.', record, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/my
   * Fetch current employee's own leave requests
   */
  async getMyLeaves(req, res, next) {
    try {
      const result = await leaveService.getMyLeaves(req.user, req.query);
      return sendSuccess(res, 'Leave requests fetched successfully.', result.records, {
        pagination: result.pagination,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/:id
   * Fetch single leave request details (with IDOR protection)
   */
  async getById(req, res, next) {
    try {
      const record = await leaveService.getById(req.user, req.params.id);
      return sendSuccess(res, 'Leave request details retrieved successfully.', record);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/leaves/:id/cancel
   * Cancel own pending leave
   */
  async cancelLeave(req, res, next) {
    try {
      const record = await leaveService.cancelLeave(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Leave request cancelled successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/team
   * Fetch team leaves for department manager
   */
  async getTeamLeaves(req, res, next) {
    try {
      const result = await leaveService.getTeamLeaves(req.user, req.query);
      return sendSuccess(res, 'Team leave requests fetched successfully.', result.records, {
        pagination: result.pagination,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/team/stats
   * Fetch team leave KPI statistics for manager / HR / admin
   */
  async getTeamLeaveStats(req, res, next) {
    try {
      const stats = await leaveService.getTeamLeaveStats(req.user, req.query);
      return sendSuccess(res, 'Team leave statistics fetched successfully.', stats);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/leaves/organization
   * Fetch organization-wide leaves for HR & Admin
   */
  async getOrgLeaves(req, res, next) {
    try {
      const result = await leaveService.getOrgLeaves(req.user, req.query);
      return sendSuccess(res, 'Organization leave records fetched successfully.', result.records, {
        summary: result.summary,
        pagination: result.pagination,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/leaves/:id/approve
   * Approve leave request (Manager / HR / Admin)
   */
  async approveLeave(req, res, next) {
    try {
      const record = await leaveService.approveLeave(req.user, req.params.id);
      return sendSuccess(res, 'Leave request approved successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/leaves/:id/reject
   * Reject leave request with reason (Manager / HR / Admin)
   */
  async rejectLeave(req, res, next) {
    try {
      const record = await leaveService.rejectLeave(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Leave request rejected successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};
