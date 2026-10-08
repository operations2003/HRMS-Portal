import { exitChecklistService } from '../services/exitChecklistService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const exitChecklistController = {
  /**
   * POST /api/v1/exit/checklists
   * Initiate exit process and create exit checklist with 5 items (HR & Admin only)
   */
  async initiateExit(req, res, next) {
    try {
      const checklist = await exitChecklistService.initiateExitChecklist(req.user, req.body);
      return sendSuccess(res, 'Exit process initiated and checklist generated successfully.', checklist, 201);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/checklists
   * Get all organization exit checklists (HR & Admin only)
   */
  async getAllChecklists(req, res, next) {
    try {
      const result = await exitChecklistService.getAllExitChecklists(req.user, req.query);
      return sendSuccess(res, 'Exit checklists retrieved successfully.', result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/checklists/my
   * Get employee's own exit checklist (Employee self-service)
   */
  async getMyChecklist(req, res, next) {
    try {
      const result = await exitChecklistService.getMyExitChecklist(req.user);
      return sendSuccess(res, 'My exit checklist retrieved successfully.', result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/exit/checklists/:id
   * Get exit checklist by ID (HR/Admin can view all; Employee can only view own)
   */
  async getChecklistById(req, res, next) {
    try {
      const checklist = await exitChecklistService.getExitChecklistById(req.user, req.params.id);
      return sendSuccess(res, 'Exit checklist retrieved successfully.', checklist);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PATCH /api/v1/exit/checklists/:id/items/:itemId
   * Update item status (Pending / Completed) (HR & Admin only)
   */
  async updateItemStatus(req, res, next) {
    try {
      const updated = await exitChecklistService.updateChecklistItemStatus(
        req.user,
        req.params.id,
        req.params.itemId,
        req.body
      );
      return sendSuccess(res, 'Checklist item status updated successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/exit/checklists/:id/complete
   * Mark exit process as completed (HR & Admin only)
   * Only allowed when all five checklist items are completed!
   */
  async completeExit(req, res, next) {
    try {
      const result = await exitChecklistService.completeExitChecklist(req.user, req.params.id, req.body);
      return sendSuccess(res, result.message, result.checklist);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * DELETE /api/v1/exit/checklists/:id
   * Delete exit checklist (HR & Admin only)
   */
  async deleteChecklist(req, res, next) {
    try {
      const result = await exitChecklistService.deleteExitChecklist(req.user, req.params.id);
      return sendSuccess(res, result.message);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },
};
