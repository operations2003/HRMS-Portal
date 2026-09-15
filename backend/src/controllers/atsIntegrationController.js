import { atsIntegrationService } from '../services/atsIntegrationService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const atsIntegrationController = {
  /**
   * POST /api/v1/integration/ats/handoff
   * Receives candidate payload from Portal 2 (ATS)
   */
  async handleCandidateHandoff(req, res, next) {
    try {
      const payload = {
        ...req.body,
        // If user is authenticated, default to their orgId if not explicitly provided
        orgId: req.body.orgId || (req.user && req.user.orgId),
      };

      const result = await atsIntegrationService.processHandoff(payload);

      return res.status(result.code).json({
        success: true,
        message: result.message,
        isIdempotent: result.isIdempotent,
        status: result.status,
        data: result.record,
      });
    } catch (error) {
      if (error.statusCode === 409) {
        return sendError(res, error.message, 409, error.details ? [JSON.stringify(error.details)] : []);
      }
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/integration/ats/status/:atsCandidateId
   * Query status of a handed-off ATS candidate
   */
  async getCandidateHandoffStatus(req, res, next) {
    try {
      const { atsCandidateId } = req.params;
      const orgId = req.query.orgId || (req.user && req.user.orgId);

      if (!orgId) {
        return sendError(res, 'orgId query parameter is required to check candidate status.', 400);
      }

      const candidate = await atsIntegrationService.getAtsCandidateStatus(orgId, atsCandidateId);
      return sendSuccess(res, 'ATS candidate status retrieved successfully.', candidate);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },
};

