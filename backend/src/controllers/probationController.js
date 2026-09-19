import { probationService } from '../services/probationService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const probationController = {
  /**
   * GET /api/v1/probation
   */
  async list(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const filters = {
        status: req.query.status,
        managerId: req.query.managerId,
        isOverdue: req.query.isOverdue,
        search: req.query.search,
      };

      // If user is a Manager without Admin/HR role, restrict to their team
      const isPrivileged = req.user.roleName && ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(req.user.roleName.toLowerCase());
      if (!isPrivileged && req.user.employeeId) {
        filters.managerId = req.user.employeeId;
      }

      const result = await probationService.listProbations(orgId, filters);
      return sendSuccess(res, 'Probation records retrieved successfully.', result);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/probation/:employeeId/evaluate
   * Manager evaluation
   */
  async evaluate(req, res, next) {
    try {
      const { employeeId } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const result = await probationService.submitEvaluation(employeeId, orgId, req.user, req.body);
      return sendSuccess(res, result.message, result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/probation/:employeeId/review
   * HR final decision (Confirm, Extend, Reject)
   */
  async review(req, res, next) {
    try {
      const { employeeId } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const result = await probationService.hrReview(employeeId, orgId, req.user, req.body);
      return sendSuccess(res, result.message, result);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

