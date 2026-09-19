import { expenseService } from '../services/expenseService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const expenseController = {
  async list(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const list = await expenseService.listExpenses(orgId, req.user, req.query);
      return sendSuccess(res, 'Expense claims retrieved.', list);
    } catch (error) {
      next(error);
    }
  },

  async submit(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const claim = await expenseService.submitClaim(orgId, req.user, req.body);
      return sendSuccess(res, 'Expense claim submitted successfully.', claim, null, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async review(req, res, next) {
    try {
      const { id } = req.params;
      const orgId = req.user.orgId || 'org-1';
      const updated = await expenseService.reviewClaim(id, orgId, req.user, req.body);
      return sendSuccess(res, `Expense claim review action recorded: ${updated.status}`, updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};

