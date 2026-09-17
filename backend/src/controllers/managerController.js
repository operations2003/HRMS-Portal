import { managerService } from '../services/managerService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const managerController = {
  /**
   * GET /api/v1/manager/dashboard
   * Manager profile & dashboard overview
   */
  async getDashboard(req, res, next) {
    try {
      const data = await managerService.getManagerDashboard(req.user);
      return sendSuccess(res, 'Manager dashboard data fetched successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team
   * List assigned team members
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
   * GET /api/v1/manager/team/members/:employeeId
   * Fetch single team member with team scope security validation
   */
  async getTeamMemberById(req, res, next) {
    try {
      const member = await managerService.getTeamMemberById(req.user, req.params.employeeId);
      return sendSuccess(res, 'Team member details fetched successfully.', member);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/summary
   * Team employee summary metrics
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
   * Team daily attendance feed
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
   * GET /api/v1/manager/team/attendance/summary
   * Team attendance aggregated metrics across date range
   */
  async getTeamAttendanceSummary(req, res, next) {
    try {
      const summary = await managerService.getTeamAttendanceSummary(req.user, req.query);
      return sendSuccess(res, 'Team attendance summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/members/:employeeId/attendance
   * Fetch attendance history of single team member with team scope security validation
   */
  async getTeamMemberAttendance(req, res, next) {
    try {
      const attendance = await managerService.getTeamMemberAttendance(req.user, req.params.employeeId, req.query);
      return sendSuccess(res, 'Team member attendance records fetched successfully.', attendance);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/leaves
   * Team leaves list
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
   * GET /api/v1/manager/team/members/:employeeId/leaves
   * Team member leave history and balance with team scope security validation
   */
  async getTeamMemberLeaves(req, res, next) {
    try {
      const data = await managerService.getTeamMemberLeaves(req.user, req.params.employeeId);
      return sendSuccess(res, 'Team member leave information fetched successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/manager/team/leaves/:leaveId/approve
   * Approve leave request of direct report
   */
  async approveTeamLeave(req, res, next) {
    try {
      const updated = await managerService.approveTeamLeave(req.user, req.params.leaveId, req.body);
      return sendSuccess(res, 'Leave request approved successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/manager/team/leaves/:leaveId/reject
   * Reject leave request of direct report
   */
  async rejectTeamLeave(req, res, next) {
    try {
      const updated = await managerService.rejectTeamLeave(req.user, req.params.leaveId, req.body);
      return sendSuccess(res, 'Leave request rejected successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/performance
   * Team performance appraisal records
   */
  async getTeamPerformance(req, res, next) {
    try {
      const records = await managerService.getTeamPerformance(req.user, req.query);
      return sendSuccess(res, 'Team performance records fetched successfully.', records);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/team/members/:employeeId/performance
   * Single team member performance records and goals with team scope security validation
   */
  async getTeamMemberPerformance(req, res, next) {
    try {
      const data = await managerService.getTeamMemberPerformance(req.user, req.params.employeeId);
      return sendSuccess(res, 'Team member performance records fetched successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/manager/approvals
   * Consolidated pending approvals queue for this manager
   */
  async getPendingApprovals(req, res, next) {
    try {
      const approvals = await managerService.getPendingApprovals(req.user, req.query);
      return sendSuccess(res, 'Pending manager approvals fetched successfully.', approvals);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/manager/assign
   * Assign or reassign reporting manager (HR / Admin only)
   */
  async assignManager(req, res, next) {
    try {
      const updated = await managerService.assignManager(req.user, req.body);
      return sendSuccess(res, 'Manager assigned successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default managerController;
