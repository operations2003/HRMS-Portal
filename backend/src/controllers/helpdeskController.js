import { helpdeskService } from '../services/helpdeskService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const helpdeskController = {
  /**
   * GET /api/v1/helpdesk/tickets
   */
  async listTickets(req, res, next) {
    try {
      const tickets = await helpdeskService.getTickets(req.user, req.query);
      return sendSuccess(res, 'Helpdesk tickets retrieved successfully.', tickets);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/helpdesk/my/tickets
   */
  async getMyTickets(req, res, next) {
    try {
      const tickets = await helpdeskService.getMyTickets(req.user, req.query);
      return sendSuccess(res, 'Your helpdesk tickets retrieved successfully.', tickets);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/helpdesk/tickets/:id
   */
  async getTicketById(req, res, next) {
    try {
      const ticket = await helpdeskService.getTicketById(req.user, req.params.id);
      return sendSuccess(res, 'Helpdesk ticket retrieved successfully.', ticket);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/helpdesk/tickets
   */
  async createTicket(req, res, next) {
    try {
      const ticket = await helpdeskService.createTicket(req.user, req.body);
      return sendSuccess(res, 'Helpdesk ticket created successfully.', ticket, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/helpdesk/tickets/:id/comments
   */
  async addComment(req, res, next) {
    try {
      const comment = await helpdeskService.addComment(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Comment posted successfully.', comment, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/helpdesk/tickets/:id/cancel
   */
  async cancelTicket(req, res, next) {
    try {
      const ticket = await helpdeskService.cancelTicket(req.user, req.params.id);
      return sendSuccess(res, 'Helpdesk ticket cancelled successfully.', ticket);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/helpdesk/tickets/:id/assign
   */
  async assignTicket(req, res, next) {
    try {
      const ticket = await helpdeskService.assignTicket(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Helpdesk ticket assigned successfully.', ticket);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/helpdesk/tickets/:id/status
   */
  async updateStatus(req, res, next) {
    try {
      const ticket = await helpdeskService.updateStatus(req.user, req.params.id, req.body.status);
      return sendSuccess(res, 'Helpdesk ticket status updated successfully.', ticket);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/helpdesk/tickets/:id/resolve
   */
  async resolveTicket(req, res, next) {
    try {
      const ticket = await helpdeskService.resolveTicket(req.user, req.params.id, req.body.resolution);
      return sendSuccess(res, 'Helpdesk ticket resolved successfully.', ticket);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/helpdesk/tickets/:id/close
   */
  async closeTicket(req, res, next) {
    try {
      const ticket = await helpdeskService.closeTicket(req.user, req.params.id);
      return sendSuccess(res, 'Helpdesk ticket closed successfully.', ticket);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/helpdesk/stats
   */
  async getStats(req, res, next) {
    try {
      const stats = await helpdeskService.getStats(req.user);
      return sendSuccess(res, 'Ticket statistics retrieved successfully.', stats);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};
