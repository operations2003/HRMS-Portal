import { performanceService } from '../services/performanceService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const performanceController = {
  // =========================================================================
  // 1. Periods
  // =========================================================================

  async createPeriod(req, res, next) {
    try {
      const period = await performanceService.createPeriod(req.user, req.body);
      return sendSuccess(res, 'Performance review period created successfully.', period, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async listPeriods(req, res, next) {
    try {
      const periods = await performanceService.getPeriods(req.user, req.query);
      return sendSuccess(res, 'Performance periods fetched successfully.', periods);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async getPeriodById(req, res, next) {
    try {
      const period = await performanceService.getPeriodById(req.user, req.params.id);
      return sendSuccess(res, 'Performance period retrieved successfully.', period);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async updatePeriod(req, res, next) {
    try {
      const period = await performanceService.updatePeriod(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Performance period updated successfully.', period);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  // =========================================================================
  // 2. Records
  // =========================================================================

  async createRecord(req, res, next) {
    try {
      const goals = req.body.goals || [];
      const record = await performanceService.createRecord(req.user, req.body, goals);
      return sendSuccess(res, 'Performance appraisal record created successfully.', record, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async listRecords(req, res, next) {
    try {
      const records = await performanceService.getRecords(req.user, req.query);
      return sendSuccess(res, 'Performance records fetched successfully.', records);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async getMyRecords(req, res, next) {
    try {
      const records = await performanceService.getMyRecords(req.user);
      return sendSuccess(res, 'My performance records fetched successfully.', records);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async getTeamRecords(req, res, next) {
    try {
      const records = await performanceService.getTeamRecords(req.user);
      return sendSuccess(res, 'Team performance reviews fetched successfully.', records);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async getRecordById(req, res, next) {
    try {
      const record = await performanceService.getRecordById(req.user, req.params.id);
      return sendSuccess(res, 'Performance record details retrieved successfully.', record);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async updateDraft(req, res, next) {
    try {
      const updated = await performanceService.updateDraftRecord(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Draft appraisal updated successfully.', updated);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async submitRecord(req, res, next) {
    try {
      const submitted = await performanceService.submitRecord(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Performance appraisal submitted for manager review.', submitted);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async managerReview(req, res, next) {
    try {
      const reviewed = await performanceService.managerReview(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Manager evaluation completed and forwarded to HR.', reviewed);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async hrApprove(req, res, next) {
    try {
      const approved = await performanceService.hrApprove(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Performance review approved by HR.', approved);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async returnRecord(req, res, next) {
    try {
      const returned = await performanceService.returnRecord(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Performance appraisal returned for revision.', returned);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async getRecordHistory(req, res, next) {
    try {
      const history = await performanceService.getRecordHistory(req.user, req.params.id);
      return sendSuccess(res, 'Workflow history retrieved successfully.', history);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  // =========================================================================
  // 3. Goals
  // =========================================================================

  async addGoal(req, res, next) {
    try {
      const goal = await performanceService.addGoal(req.user, req.params.id, req.body);
      return sendSuccess(res, 'Goal added to performance appraisal.', goal, 201);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async updateGoal(req, res, next) {
    try {
      const goal = await performanceService.updateGoal(req.user, req.params.goalId, req.body);
      return sendSuccess(res, 'Goal updated successfully.', goal);
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  async deleteGoal(req, res, next) {
    try {
      await performanceService.deleteGoal(req.user, req.params.goalId);
      return sendSuccess(res, 'Goal removed successfully.');
    } catch (error) {
      if (error.statusCode) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

export default performanceController;
