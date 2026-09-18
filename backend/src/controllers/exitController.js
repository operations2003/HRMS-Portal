import { exitService } from '../services/exitService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const exitController = {
  /**
   * POST /api/v1/exit/resign
   */
  async submitResignation(req, res, next) {
    try {
      const exitRequest = await exitService.submitResignation(req.user, req.body);
      return sendSuccess(res, 'Resignation submitted successfully.', exitRequest, 201);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/my
   */
  async getMyExit(req, res, next) {
    try {
      const exit = await exitService.getMyExit(req.user);
      return sendSuccess(res, 'My exit details retrieved successfully.', exit);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/team
   */
  async getTeamExits(req, res, next) {
    try {
      const teamExits = await exitService.getTeamExits(req.user, req.query);
      return sendSuccess(res, 'Team exit records retrieved successfully.', teamExits);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/requests
   */
  async getAllExits(req, res, next) {
    try {
      const exits = await exitService.getAllExits(req.user, req.query);
      return sendSuccess(res, 'Exit records retrieved successfully.', exits);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/requests/:id
   */
  async getExitById(req, res, next) {
    try {
      const exit = await exitService.getExitById(req.user, req.params.id);
      return sendSuccess(res, 'Exit dossier retrieved successfully.', exit);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/manager-review
   */
  async managerReview(req, res, next) {
    try {
      const updated = await exitService.managerReview(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Manager exit review submitted successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/hr-approve
   */
  async hrApprove(req, res, next) {
    try {
      const updated = await exitService.hrApprove(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Resignation approved and notice period initiated.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/requests/:id/clearances
   */
  async getClearances(req, res, next) {
    try {
      const clearances = await exitService.getClearances(req.user, req.params.id);
      return sendSuccess(res, 'Departmental clearance checklist retrieved.', clearances);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PATCH /api/v1/exit/clearances/:taskId
   */
  async updateClearanceTask(req, res, next) {
    try {
      const updated = await exitService.updateClearanceTask(req.user, req.params.taskId, req.body);
      return sendSuccess(res, 'Clearance task updated successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/requests/:id/fnf
   */
  async getFnf(req, res, next) {
    try {
      const exit = await exitService.getExitById(req.user, req.params.id);
      return sendSuccess(res, 'FnF settlement details retrieved.', exit.fnf);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/fnf
   */
  async calculateFnf(req, res, next) {
    try {
      const fnf = await exitService.calculateFnf(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Full & Final settlement calculated successfully.', fnf);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/deprovision
   */
  async deprovisionAccess(req, res, next) {
    try {
      const result = await exitService.deprovisionAccess(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Access deprovisioned and exit process completed.', result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },
};

