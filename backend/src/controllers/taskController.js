import { taskService } from '../services/taskService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const taskController = {
  async list(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const tasks = await taskService.listTasks(orgId, req.user, req.query);
      return sendSuccess(res, 'Tasks retrieved successfully.', tasks);
    } catch (error) {
      next(error);
    }
  },

  async create(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const task = await taskService.createTask(orgId, req.user, req.body);
      return sendSuccess(res, 'Task created successfully.', task, null, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async updateStatus(req, res, next) {
    try {
      const { id } = req.params;
      const { status } = req.body;
      const orgId = req.user.orgId || 'org-1';
      const updated = await taskService.updateStatus(id, orgId, req.user, status);
      return sendSuccess(res, 'Task status updated.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async addComment(req, res, next) {
    try {
      const { id } = req.params;
      const { text } = req.body;
      const orgId = req.user.orgId || 'org-1';
      const updated = await taskService.addComment(id, orgId, req.user, text);
      return sendSuccess(res, 'Comment posted successfully.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async updateSubtasks(req, res, next) {
    try {
      const { id } = req.params;
      const { subtasks } = req.body;
      const orgId = req.user.orgId || 'org-1';
      const updated = await taskService.updateSubtasks(id, orgId, subtasks);
      return sendSuccess(res, 'Subtasks updated.', updated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async getMyPerformance(req, res, next) {
    try {
      const orgId = req.user.orgId || 'org-1';
      const timeframe = req.query.timeframe || 'this_month';
      const metrics = await taskService.getMyPerformance(orgId, req.user, timeframe);
      return sendSuccess(res, 'Task performance metrics retrieved successfully.', metrics);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async rate(req, res, next) {
    try {
      const { id } = req.params;
      const { rating, feedback } = req.body;
      const orgId = req.user.orgId || 'org-1';
      const rated = await taskService.rateTask(id, orgId, req.user, { rating, feedback });
      return sendSuccess(res, 'Task rated successfully.', rated);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  async reopen(req, res, next) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const orgId = req.user.orgId || 'org-1';
      const reopened = await taskService.reopenTask(id, orgId, req.user, { reason });
      return sendSuccess(res, 'Task reopened successfully.', reopened);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};

