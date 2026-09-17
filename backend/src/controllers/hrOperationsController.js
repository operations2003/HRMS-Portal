import { hrOperationsService } from '../services/hrOperationsService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const hrOperationsController = {
  /**
   * GET /api/v1/hr/operations/overview
   */
  async getOverview(req, res, next) {
    try {
      const overview = await hrOperationsService.getOperationsOverview(req.user);
      return sendSuccess(res, 'HR operations summary fetched successfully.', overview);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/approval-queue
   */
  async getApprovalQueue(req, res, next) {
    try {
      const queue = await hrOperationsService.getUnifiedApprovalQueue(req.user);
      return sendSuccess(res, 'Unified approval queue fetched successfully.', queue);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/hr/operations/broadcast
   */
  async broadcastAnnouncement(req, res, next) {
    try {
      const result = await hrOperationsService.broadcastAnnouncement(req.user, req.body);
      return sendSuccess(res, 'Operational announcement broadcasted successfully.', result, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/employees/:id
   */
  async getEmployeeProfile(req, res, next) {
    try {
      const data = await hrOperationsService.getEmployeeOperationalProfile(req.user, req.params.id);
      return sendSuccess(res, 'Employee operational profile fetched successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/teams
   */
  async getTeams(req, res, next) {
    try {
      const teams = await hrOperationsService.getTeamsOverview(req.user);
      return sendSuccess(res, 'Teams overview fetched successfully.', teams);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/teams/:managerId
   */
  async getTeamByManager(req, res, next) {
    try {
      const team = await hrOperationsService.getTeamByManager(req.user, req.params.managerId);
      return sendSuccess(res, 'Manager team details fetched successfully.', team);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/performance/summary
   */
  async getPerformanceSummary(req, res, next) {
    try {
      const summary = await hrOperationsService.getPerformanceSummary(req.user);
      return sendSuccess(res, 'Performance summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/attendance/summary
   */
  async getAttendanceSummary(req, res, next) {
    try {
      const summary = await hrOperationsService.getAttendanceSummary(req.user);
      return sendSuccess(res, 'Attendance summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/leaves/summary
   */
  async getLeaveSummary(req, res, next) {
    try {
      const summary = await hrOperationsService.getLeaveSummary(req.user);
      return sendSuccess(res, 'Leave summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default hrOperationsController;
