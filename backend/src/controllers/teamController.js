import { teamService } from '../services/teamService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const teamController = {
  /**
   * GET /api/v1/team
   * View team members according to role authorization
   */
  async getTeamMembers(req, res, next) {
    try {
      const members = await teamService.getTeamMembers(req.user, req.query);
      return sendSuccess(res, 'Team members fetched successfully.', members);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/summary
   * Team summary statistics
   */
  async getTeamSummary(req, res, next) {
    try {
      const summary = await teamService.getTeamSummary(req.user, req.query);
      return sendSuccess(res, 'Team summary metrics fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/members/:id
   * Team employee details where authorized
   */
  async getTeamEmployeeDetails(req, res, next) {
    try {
      const details = await teamService.getTeamEmployeeDetails(req.user, req.params.id);
      return sendSuccess(res, 'Team employee details fetched successfully.', details);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/attendance
   * Team attendance daily log
   */
  async getTeamAttendance(req, res, next) {
    try {
      const attendance = await teamService.getTeamAttendance(req.user, req.query);
      return sendSuccess(res, 'Team attendance records fetched successfully.', attendance);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/attendance/summary
   * Team attendance summary across date range
   */
  async getTeamAttendanceSummary(req, res, next) {
    try {
      const summary = await teamService.getTeamAttendanceSummary(req.user, req.query);
      return sendSuccess(res, 'Team attendance summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/members/:id/attendance
   * Team member attendance history where authorized
   */
  async getTeamMemberAttendance(req, res, next) {
    try {
      const records = await teamService.getTeamMemberAttendance(req.user, req.params.id, req.query);
      return sendSuccess(res, 'Team member attendance history fetched successfully.', records);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/leaves
   * Team leave requests
   */
  async getTeamLeaves(req, res, next) {
    try {
      const leaves = await teamService.getTeamLeaves(req.user, req.query);
      return sendSuccess(res, 'Team leaves fetched successfully.', leaves);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/leaves/summary
   * Team leave summary
   */
  async getTeamLeaveSummary(req, res, next) {
    try {
      const summary = await teamService.getTeamLeaveSummary(req.user, req.query);
      return sendSuccess(res, 'Team leave summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/members/:id/leaves
   * Team member leave details and balances where authorized
   */
  async getTeamMemberLeaves(req, res, next) {
    try {
      const data = await teamService.getTeamMemberLeaves(req.user, req.params.id);
      return sendSuccess(res, 'Team member leave information fetched successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/performance
   * Team performance appraisal records
   */
  async getTeamPerformance(req, res, next) {
    try {
      const performance = await teamService.getTeamPerformance(req.user, req.query);
      return sendSuccess(res, 'Team performance records fetched successfully.', performance);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/performance/summary
   * Team performance summary metrics
   */
  async getTeamPerformanceSummary(req, res, next) {
    try {
      const summary = await teamService.getTeamPerformanceSummary(req.user, req.query);
      return sendSuccess(res, 'Team performance summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/members/:id/performance
   * Team member performance records where authorized
   */
  async getTeamMemberPerformance(req, res, next) {
    try {
      const data = await teamService.getTeamMemberPerformance(req.user, req.params.id);
      return sendSuccess(res, 'Team member performance records fetched successfully.', data);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/team/assign
   * Assign or update team manager (HR and Admin only)
   */
  async assignTeamManager(req, res, next) {
    try {
      const updated = await teamService.assignTeamManager(req.user, req.body);
      return sendSuccess(res, 'Team manager assignment updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/team/documents
   * Get documents uploaded by team members
   */
  async getTeamDocuments(req, res, next) {
    try {
      const filters = {
        search: req.query.search,
        status: req.query.status,
        category: req.query.category,
      };
      const docs = await teamService.getTeamDocuments(req.user, filters);
      return sendSuccess(res, 'Team documents retrieved successfully.', docs);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/team/documents/:id/verify
   * Approve or reject a team member's document
   */
  async verifyTeamDocument(req, res, next) {
    try {
      const { id } = req.params;
      const { verificationStatus, rejectionReason } = req.body;
      const updated = await teamService.verifyTeamDocument(req.user, id, {
        verificationStatus,
        rejectionReason,
      });
      return sendSuccess(
        res,
        verificationStatus === 'VERIFIED'
          ? 'Document approved successfully.'
          : 'Document rejected successfully.',
        updated
      );
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default teamController;
