import { workflowService } from '../services/workflowService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const workflowController = {
  /**
   * GET /api/v1/workflows/pending
   */
  async getPendingQueue(req, res, next) {
    try {
      const queue = await workflowService.getPendingQueue(req.user, req.query);
      return sendSuccess(res, 'Pending approval queue retrieved successfully.', queue);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/workflows/:id
   */
  async getById(req, res, next) {
    try {
      const wf = await workflowService.getWorkflowById(req.user, req.params.id);
      return sendSuccess(res, 'Workflow details retrieved successfully.', wf);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/workflows/:id/action
   */
  async executeAction(req, res, next) {
    try {
      const updated = await workflowService.executeAction(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Workflow action recorded successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/workflows/entity/:entityType/:entityId/audit
   */
  async getAuditTrail(req, res, next) {
    try {
      const { entityType, entityId } = req.params;
      const audit = await workflowService.getEntityAuditTrail(req.user, entityType, entityId);
      return sendSuccess(res, 'Audit trail retrieved successfully.', audit);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default workflowController;
