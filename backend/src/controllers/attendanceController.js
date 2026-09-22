import { attendanceService } from '../services/attendanceService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const attendanceController = {
  /**
   * POST /api/v1/attendance/check-in
   * Record check-in punch
   */
  async checkIn(req, res, next) {
    try {
      const clientIp = req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress || '';

      const record = await attendanceService.checkIn(req.user, req.body, clientIp);
      return sendSuccess(res, 'Check-in recorded successfully.', record, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/attendance/check-out
   * Record check-out punch
   */
  async checkOut(req, res, next) {
    try {
      const record = await attendanceService.checkOut(req.user, req.body);
      return sendSuccess(res, 'Check-out recorded successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/attendance/pause-break
   * Pause shift for break
   */
  async pauseBreak(req, res, next) {
    try {
      const record = await attendanceService.pauseBreak(req.user);
      return sendSuccess(res, 'Work session paused for break.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/attendance/resume-break
   * Resume shift after break
   */
  async resumeBreak(req, res, next) {
    try {
      const record = await attendanceService.resumeBreak(req.user);
      return sendSuccess(res, 'Break ended. Work session resumed.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/attendance/my
   * Fetch authenticated user's own attendance history
   */
  async getMyAttendance(req, res, next) {
    try {
      const result = await attendanceService.getMyAttendance(req.user, req.query);
      return sendSuccess(res, 'Attendance history fetched successfully.', result.records, {
        statistics: result.statistics,
        pagination: result.pagination,
        employeeProfile: result.employeeProfile,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/attendance/team
   * Fetch team attendance for Manager (scoped to department)
   */
  async getTeamAttendance(req, res, next) {
    try {
      const result = await attendanceService.getTeamAttendance(req.user, req.query);
      return sendSuccess(res, 'Team attendance fetched successfully.', result.records, {
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
   * GET /api/v1/attendance/organization/analytics
   * Aggregated Attendance Trend, Status Distribution, and KPI Metrics for Admin/HR
   */
  async getOrgAnalytics(req, res, next) {
    try {
      const result = await attendanceService.getOrgAnalytics(req.user, req.query);
      return sendSuccess(res, 'Organization attendance analytics fetched successfully.', result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/attendance/organization
   * Fetch organization-wide attendance & stats for HR / Admin
   */
  async getOrgAttendance(req, res, next) {
    try {
      const result = await attendanceService.getOrgAttendance(req.user, req.query);
      return sendSuccess(res, 'Organization attendance records fetched successfully.', result.records, {
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
   * GET /api/v1/attendance/:id
   * Fetch single attendance record details with IDOR protection
   */
  async getById(req, res, next) {
    try {
      const record = await attendanceService.getById(req.user, req.params.id);
      return sendSuccess(res, 'Attendance details retrieved successfully.', record);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/attendance/:id/regularize
   * Regularize attendance record (Admin, HR, Manager)
   */
  async regularize(req, res, next) {
    try {
      const record = await attendanceService.regularize(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Attendance regularized successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/attendance/:id/remark
   * Add Emergency or OT remark on attendance record (Admin, HR, Manager)
   */
  async addShiftRemark(req, res, next) {
    try {
      const record = await attendanceService.addShiftRemark(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Shift remark recorded successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

