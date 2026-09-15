import { onboardingService } from '../services/onboardingService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const onboardingController = {
  /**
   * GET /api/v1/onboarding/new-hires
   */
  async getNewHires(req, res, next) {
    try {
      const orgId = req.query.orgId || (req.user && req.user.orgId);
      const { lifecycleState, onboardingStatus, bgvStatus, search, page = 1, limit = 20 } = req.query;

      const result = await onboardingService.getNewHires(
        {
          orgId,
          lifecycleState,
          onboardingStatus,
          bgvStatus,
          search,
        },
        {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
        }
      );

      return sendSuccess(res, 'New hires retrieved successfully.', result.items, result.pagination);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/onboarding/new-hires/:id
   */
  async getNewHireById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await onboardingService.getNewHireById(id);
      return sendSuccess(res, 'New hire details retrieved successfully.', data);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/onboarding/new-hires/:id/initiate
   */
  async initiateOnboarding(req, res, next) {
    try {
      const { id } = req.params;
      const data = await onboardingService.initiateOnboarding(id);
      return sendSuccess(res, 'Onboarding initiated successfully for candidate.', data);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/onboarding/new-hires/:id/readiness
   */
  async updateReadiness(req, res, next) {
    try {
      const { id } = req.params;
      const data = await onboardingService.updateReadinessTracker(id, req.body);
      return sendSuccess(res, 'Readiness tracker updated successfully.', data);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PUT /api/v1/onboarding/new-hires/:id/bgv
   */
  async updateBgv(req, res, next) {
    try {
      const { id } = req.params;
      const { bgvStatus } = req.body;
      const data = await onboardingService.updateBgvStatus(id, bgvStatus);
      return sendSuccess(res, 'BGV status updated successfully.', data);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/onboarding/new-hires/:id/convert-to-employee
   */
  async convertToEmployee(req, res, next) {
    try {
      const { id } = req.params;
      const result = await onboardingService.convertToEmployee(id, req.body);
      return sendSuccess(res, result.message, {
        employeeId: result.employeeId,
        employeeCode: result.employeeCode,
        employee: result.employee,
        newHire: result.newHire,
      });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },
};

