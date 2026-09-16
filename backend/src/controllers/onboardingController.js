import { onboardingService } from '../services/onboardingService.js';
import { atsIntegrationService } from '../services/atsIntegrationService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { logger } from '../utils/logger.js';

export const onboardingController = {
  /**
   * POST /api/v1/onboarding/ats-handoff
   * Receive ATS hiring payload with candidate info, job, department, manager, compensation ref, offer documents
   */
  async handleAtsHandoff(req, res, next) {
    try {
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
      const requestId = req.headers['x-request-id'] || idempotencyKey || `req_${Date.now()}`;

      const payload = {
        ...req.body,
        orgId: req.body.orgId || (req.user && req.user.orgId),
      };

      const result = await atsIntegrationService.processHandoff(payload, {
        idempotencyKey,
        requestId,
      });

      if (result.isIdempotent) {
        res.setHeader('X-Idempotent-Replay', 'true');
      }
      res.setHeader('X-Request-Id', requestId);

      return res.status(result.code).json({
        success: true,
        message: result.message,
        isIdempotent: result.isIdempotent,
        status: result.status,
        data: result.record,
      });
    } catch (error) {
      if (error.statusCode === 409 || error.code === 'DUPLICATE_ENTRY') {
        const errorReason = error.details?.conflictReason || error.message;
        return sendError(res, error.message, 409, [errorReason]);
      }
      if (error.statusCode === 400 || error.statusCode === 404) {
        return sendError(res, error.message, error.statusCode);
      }
      logger.error('ATS-HANDOFF', 'Unhandled exception during ATS handoff', error);
      next(error);
    }
  },

  /**
   * GET /api/v1/onboarding/new-hires
   * Fetch listing with filters (status, joining date, department, search)
   */
  async getNewHires(req, res, next) {
    try {
      const orgId = req.query.orgId || (req.user && req.user.orgId);
      const {
        status,
        lifecycleState,
        onboardingStatus,
        bgvStatus,
        joiningDate,
        dateOfJoining,
        joiningDateFrom,
        joiningDateTo,
        deptId,
        department,
        search,
        page = 1,
        limit = 20,
      } = req.query;

      // If user is a department Manager without system-wide admin permissions, filter to their department
      let scopedDeptId = deptId;
      if (req.user && req.user.roleName === 'Manager' && req.user.deptId && !deptId) {
        scopedDeptId = req.user.deptId;
      }

      const result = await onboardingService.getNewHires(
        {
          orgId,
          status,
          lifecycleState,
          onboardingStatus,
          bgvStatus,
          joiningDate: joiningDate || dateOfJoining,
          joiningDateFrom,
          joiningDateTo,
          deptId: scopedDeptId,
          department,
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
   * GET /api/v1/onboarding/new-hires/:id or /api/v1/onboarding/:id
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
   * GET /api/v1/onboarding/:id/status
   * Fetch progress checklist, document verification status, IT setup readiness, and BGV state
   */
  async getOnboardingStatus(req, res, next) {
    try {
      const { id } = req.params;
      const statusData = await onboardingService.getOnboardingStatus(id);
      return sendSuccess(res, 'Onboarding status retrieved successfully.', statusData);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/onboarding/:id/checklist
   * Update individual workflow checklist items
   */
  async updateChecklist(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await onboardingService.updateChecklist(id, req.body);
      return sendSuccess(res, 'Onboarding checklist updated successfully.', {
        id: updated.id,
        readinessTracker: updated.readinessTracker,
        onboardingStatus: updated.onboardingStatus,
        lifecycleState: updated.lifecycleState,
      });
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/onboarding/:id/documents/upload
   * Secure file upload route with file type validation and metadata persistence
   */
  async uploadDocument(req, res, next) {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return sendError(res, 'Please attach a valid file in the form field "file".', 400);
      }

      const docRecord = await onboardingService.uploadDocument(id, file, req.body, req.user);
      return sendSuccess(res, 'Document uploaded and added to vault successfully.', docRecord, null, 201);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/onboarding/documents/:docId/verify
   * Approve/Reject document status
   */
  async verifyDocument(req, res, next) {
    try {
      const { docId } = req.params;
      const { verificationStatus, rejectionReason } = req.body;

      const verified = await onboardingService.verifyDocument(
        docId,
        {
          verificationStatus,
          rejectionReason,
        },
        req.user
      );

      return sendSuccess(
        res,
        `Document verification status updated to '${verified.verificationStatus}'.`,
        verified
      );
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * GET /api/v1/onboarding/:id/it-setup
   * Manage provisioning status (email, system access, accounts)
   */
  async getItSetup(req, res, next) {
    try {
      const { id } = req.params;
      const itSetup = await onboardingService.getItSetup(id);
      return sendSuccess(res, 'IT setup provisioning details retrieved.', itSetup);
    } catch (error) {
      if (error.statusCode === 404) {
        return sendError(res, error.message, 404);
      }
      next(error);
    }
  },

  /**
   * PATCH /api/v1/onboarding/:id/it-setup
   * Manage provisioning status (email, system access, accounts)
   */
  async updateItSetup(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await onboardingService.updateItSetup(id, req.body, req.user);
      return sendSuccess(res, 'IT setup provisioning updated successfully.', updated);
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 400) {
        return sendError(res, error.message, error.statusCode);
      }
      next(error);
    }
  },

  /**
   * POST /api/v1/onboarding/:id/convert-to-employee
   * Day-1 conversion logic linking new hire to Employee Master without creating duplicate profiles
   */
  async convertToEmployee(req, res, next) {
    try {
      const { id } = req.params;
      const result = await onboardingService.convertToEmployee(id, req.body);
      return sendSuccess(res, result.message, {
        employeeId: result.employeeId,
        employeeCode: result.employeeCode,
        isExistingProfileLinked: result.isExistingProfileLinked,
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
};
