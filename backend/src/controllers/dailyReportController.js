import { dailyReportService } from '../services/dailyReportService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const dailyReportController = {
  /**
   * POST /api/v1/daily-reports
   * Submit or update daily work report
   */
  async submitReport(req, res, next) {
    try {
      const record = await dailyReportService.submitReport(req.user, req.body);
      return sendSuccess(res, 'Daily work report submitted successfully.', record, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/daily-reports/my/today
   * Get employee's report for today
   */
  async getMyTodayReport(req, res, next) {
    try {
      const result = await dailyReportService.getMyTodayReport(req.user);
      return sendSuccess(res, "Today's daily report fetched successfully.", result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/daily-reports/my
   * Get employee's past reports history
   */
  async getMyReports(req, res, next) {
    try {
      const result = await dailyReportService.getMyReports(req.user, req.query);
      return sendSuccess(res, 'Daily reports history fetched successfully.', result.records, {
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
   * GET /api/v1/daily-reports/team
   * Get team/organization daily work reports (Manager, HR, Admin)
   */
  async getTeamReports(req, res, next) {
    try {
      const result = await dailyReportService.getTeamReports(req.user, req.query);
      return sendSuccess(res, 'Team daily work reports fetched successfully.', result.records, {
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
   * GET /api/v1/daily-reports/summary
   * Compliance & metric summary for a date
   */
  async getSummary(req, res, next) {
    try {
      const summary = await dailyReportService.getSummary(req.user, req.query);
      return sendSuccess(res, 'Daily report summary fetched successfully.', summary);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/daily-reports/:id/feedback
   * Acknowledge report and provide manager feedback
   */
  async addFeedback(req, res, next) {
    try {
      const record = await dailyReportService.addFeedback(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Feedback submitted and report acknowledged successfully.', record, 200);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};
