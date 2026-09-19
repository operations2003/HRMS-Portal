import { analyticsService } from '../services/analyticsService.js';
import { sendSuccess } from '../utils/apiResponse.js';

export const analyticsController = {
  async getWorkforceAnalytics(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const data = await analyticsService.getWorkforceAnalytics(orgId);
      return sendSuccess(res, 'Workforce analytics retrieved successfully.', data);
    } catch (error) {
      next(error);
    }
  },
};

