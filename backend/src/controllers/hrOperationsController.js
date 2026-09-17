import { hrOperationsService } from '../services/hrOperationsService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const hrOperationsController = {
  /**
   * GET /api/v1/hr/operations/overview
   */
  async getOverview(req, res, next) {
    try {
      const overview = await hrOperationsService.getOperationsOverview(req.user);
      return sendSuccess(res, 'HR operations summary fetched successfully.', overview);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/hr/operations/approval-queue
   */
  async getApprovalQueue(req, res, next) {
    try {
      const queue = await hrOperationsService.getUnifiedApprovalQueue(req.user);
      return sendSuccess(res, 'Unified approval queue fetched successfully.', queue);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/hr/operations/broadcast
   */
  async broadcastAnnouncement(req, res, next) {
    try {
      const result = await hrOperationsService.broadcastAnnouncement(req.user, req.body);
      return sendSuccess(res, 'Operational announcement broadcasted successfully.', result, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default hrOperationsController;
