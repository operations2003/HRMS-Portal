import { publishedReportService } from '../services/publishedReportService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const publishedReportController = {
  /**
   * POST /api/v1/performance-reports/send
   * Publish & send a performance report specifically to the selected employee
   */
  async sendReport(req, res, next) {
    try {
      const report = await publishedReportService.sendReport(req.user, req.body);
      return sendSuccess(
        res,
        `Performance report successfully dispatched to ${report.employeeName}! (Sent count: ${report.sentCount})`,
        report,
        200
      );
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/performance-reports/my
   * Fetch active performance reports delivered specifically to the current user
   */
  async getMyReports(req, res, next) {
    try {
      const reports = await publishedReportService.getMyReports(req.user);
      return sendSuccess(res, 'My performance reports fetched successfully.', {
        items: reports,
        total: reports.length,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * DELETE /api/v1/performance-reports/:id
   * Recipient user deletes their performance report
   */
  async deleteMyReport(req, res, next) {
    try {
      const deleted = await publishedReportService.deleteMyReport(req.user, req.params.id);
      return sendSuccess(
        res,
        'Performance report removed from your view. It can be re-sent by an authorized reviewer if needed.',
        deleted
      );
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/performance-reports/sent
   * List sent reports across the organization/team for authorized reviewers
   */
  async getSentReports(req, res, next) {
    try {
      const reports = await publishedReportService.listSentReports(req.user, {
        department: req.query.department,
        employeeId: req.query.employeeId,
      });
      return sendSuccess(res, 'Sent performance reports fetched successfully.', {
        items: reports,
        total: reports.length,
      });
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/performance-reports/status/:employeeId
   * Check sent/delivery status of a report for a specific employee
   */
  async getEmployeeStatus(req, res, next) {
    try {
      const status = await publishedReportService.getEmployeeReportStatus(
        req.user,
        req.params.employeeId,
        req.query.department || 'operations'
      );
      return sendSuccess(res, 'Employee report status retrieved.', status);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default publishedReportController;
