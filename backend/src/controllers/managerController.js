import { managerService } from '../services/managerService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const managerController = {
  /**
   * GET /api/v1/manager/team
   */
  async getTeamMembers(req, res, next) {
    try {
      const members = await managerService.getTeamMembers(req.user, req.query);
      return sendSuccess(res, 'Team members fetched successfully.', members);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/summary
   */
  async getTeamSummary(req, res, next) {
    try {
      const summary = await managerService.getTeamSummary(req.user, req.query);
      return sendSuccess(res, 'Team summary metrics fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/attendance
   */
  async getTeamAttendance(req, res, next) {
    try {
      const attendance = await managerService.getTeamAttendance(req.user, req.query);
      return sendSuccess(res, 'Team attendance fetched successfully.', attendance);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/leaves
   */
  async getTeamLeaves(req, res, next) {
    try {
      const leaves = await managerService.getTeamLeaves(req.user, req.query);
      return sendSuccess(res, 'Team leaves fetched successfully.', leaves);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/manager/assign
   */
  async assignManager(req, res, next) {
    try {
      const result = await managerService.assignManager(req.user, req.body);
      return sendSuccess(res, 'Employee reporting manager updated successfully.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default managerController;
