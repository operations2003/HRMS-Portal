import { overtimeService } from '../services/overtimeService.js';
import { autoCheckoutStaleRecords } from '../services/attendanceService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const overtimeController = {
  /**
   * POST /api/v1/attendance/overtime/login
   * Start employee overtime session
   */
  async loginOvertime(req, res, next) {
    try {
      const clientIp = req.headers['x-forwarded-for']
        ? req.headers['x-forwarded-for'].split(',')[0].trim()
        : req.ip || req.socket?.remoteAddress || '';

      const record = await overtimeService.loginOvertime(req.user, req.body, clientIp);
      return sendSuccess(res, 'Overtime session started successfully.', record, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/attendance/overtime/logout
   * End employee overtime session
   */
  async logoutOvertime(req, res, next) {
    try {
      const record = await overtimeService.logoutOvertime(req.user, req.body);
      return sendSuccess(res, 'Overtime session ended successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/attendance/overtime/today
   * Get employee today's overtime status and records
   */
  async getTodayOvertime(req, res, next) {
    try {
      const data = await overtimeService.getTodayOvertime(req.user);
      return sendSuccess(res, 'Today overtime retrieved successfully.', data, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/attendance/overtime/history
   * Get employee overtime history
   */
  async getOvertimeHistory(req, res, next) {
    try {
      const data = await overtimeService.getOvertimeHistory(req.user, req.query);
      return sendSuccess(res, 'Overtime history retrieved successfully.', data, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/attendance/cron/auto-logout
   * Trigger automatic shift grace logout sweep (e.g. for external scheduler)
   */
  async triggerAutoLogoutSweep(req, res, next) {
    try {
      const count = await autoCheckoutStaleRecords(req.user?.orgId || null);
      return sendSuccess(res, `Auto-logout sweep executed. Closed ${count} stale record(s).`, { closedCount: count }, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

