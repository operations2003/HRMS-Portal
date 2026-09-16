import { employeeRequestService } from '../services/employeeRequestService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const employeeRequestController = {
  /**
   * GET /api/v1/requests
   */
  async listRequests(req, res, next) {
    try {
      const requests = await employeeRequestService.getRequests(req.user, req.query);
      return sendSuccess(res, 'Employee requests retrieved successfully.', requests);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/requests/my
   */
  async getMyRequests(req, res, next) {
    try {
      const requests = await employeeRequestService.getMyRequests(req.user, req.query);
      return sendSuccess(res, 'Your requests retrieved successfully.', requests);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/requests/:id
   */
  async getRequestById(req, res, next) {
    try {
      const request = await employeeRequestService.getRequestById(req.user, req.params.id);
      return sendSuccess(res, 'Employee request retrieved successfully.', request);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/requests
   */
  async createRequest(req, res, next) {
    try {
      const request = await employeeRequestService.createRequest(req.user, req.body);
      return sendSuccess(res, 'Employee request submitted successfully.', request, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/requests/:id/updates
   */
  async addUpdate(req, res, next) {
    try {
      const update = await employeeRequestService.addUpdate(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Update posted successfully.', update, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/requests/:id/cancel
   */
  async cancelRequest(req, res, next) {
    try {
      const request = await employeeRequestService.cancelRequest(req.user, req.params.id);
      return sendSuccess(res, 'Employee request cancelled successfully.', request);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/requests/:id/assign
   */
  async assignRequest(req, res, next) {
    try {
      const request = await employeeRequestService.assignRequest(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Employee request assigned successfully.', request);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/requests/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const request = await employeeRequestService.updateStatus(req.user, req.params.id, req.body.status);
      return sendSuccess(res, 'Employee request status updated successfully.', request);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/requests/:id/resolve
   */
  async resolveRequest(req, res, next) {
    try {
      const request = await employeeRequestService.resolveRequest(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Employee request resolved successfully.', request);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/requests/:id/reject
   */
  async rejectRequest(req, res, next) {
    try {
      const request = await employeeRequestService.rejectRequest(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Employee request rejected.', request);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/requests/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await employeeRequestService.getStats(req.user);
      return sendSuccess(res, 'Request statistics retrieved successfully.', stats);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};
