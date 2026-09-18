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
   * POST /api/v1/exit/requests/:id/withdraw
   */
  async withdrawResignation(req, res, next) {
    try {
      const updated = await exitService.withdrawResignation(req.user, req.params.id, req.body.reason);
      return sendSuccess(res, 'Resignation withdrawn successfully.', updated);
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
   * POST /api/v1/exit/requests/:id/hr-reject
   */
  async hrReject(req, res, next) {
    try {
      const updated = await exitService.hrReject(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Resignation rejected by HR.', updated);
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
   * POST /api/v1/exit/requests/:id/clearances
   */
  async createClearanceTask(req, res, next) {
    try {
      const created = await exitService.createClearanceTask(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Custom clearance task added successfully.', created, 201);
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
   * GET /api/v1/exit/requests/:id/offboarding
   */
  async getOffboarding(req, res, next) {
    try {
      const offboarding = await exitService.getOffboarding(req.user, req.params.id);
      return sendSuccess(res, 'Offboarding workflow status retrieved.', offboarding);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PATCH /api/v1/exit/requests/:id/offboarding
   */
  async updateOffboarding(req, res, next) {
    try {
      const updated = await exitService.updateOffboarding(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Offboarding status updated.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/access-removal
   */
  async removeAccess(req, res, next) {
    try {
      const result = await exitService.removeAccess(req.user, req.params.id, req.body);
      return sendSuccess(res, 'System access revoked and credentials deprovisioned.', result);
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
   * POST /api/v1/exit/requests/:id/fnf/approve
   */
  async approveFnf(req, res, next) {
    try {
      const fnf = await exitService.approveFnf(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Full & Final settlement approved successfully.', fnf);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/fnf/disburse
   */
  async disburseFnf(req, res, next) {
    try {
      const fnf = await exitService.disburseFnf(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Full & Final settlement payment disbursed successfully.', fnf);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/requests/:id/complete
   */
  async completeExit(req, res, next) {
    try {
      const result = await exitService.completeExit(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Exit formalities successfully concluded.', result);
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

  /**
   * GET /api/v1/exit/admin/stats
   */
  async getAdminStats(req, res, next) {
    try {
      const stats = await exitService.getAdminStats(req.user);
      return sendSuccess(res, 'Exit module analytics retrieved successfully.', stats);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },
};
