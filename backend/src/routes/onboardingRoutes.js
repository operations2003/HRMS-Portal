import { Router } from 'express';
import { onboardingController } from '../controllers/onboardingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { uploadSingleDocument } from '../middleware/uploadMiddleware.js';
import { validateAtsHandoff } from '../validators/atsValidator.js';
import {
  validateChecklistUpdate,
  validateReadinessUpdate,
  validateBgvUpdate,
  validateConvertToEmployee,
  validateItSetupUpdate,
} from '../validators/onboardingValidator.js';
import {
  validateVerifyDocument,
  validateDocumentUploadMetadata,
} from '../validators/documentValidator.js';

const router = Router();

/**
 * Authentication helper allowing ATS Secret Key (x-api-key / x-ats-key) or Bearer JWT token
 */
const authenticateAtsOrUser = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['x-ats-key'];
  const expectedKey = process.env.ATS_INTEGRATION_KEY || 'tasknera-ats-integration-secret-2025';

  if (apiKey && apiKey === expectedKey) {
    req.user = {
      id: 'system-ats',
      email: 'ats-system@tasknera.internal',
      roleName: 'SuperAdmin',
      permissions: ['ats:integrate', 'onboarding:write', 'onboarding:read', 'employee:write'],
    };
    return next();
  }

  return authenticate(req, res, next);
};

// =====================================================================
// 1. ATS -> HRMS Handoff API
// =====================================================================
router.post(
  '/ats-handoff',
  authenticateAtsOrUser,
  authorize(['ats:integrate', 'onboarding:write']),
  validate(validateAtsHandoff),
  onboardingController.handleAtsHandoff
);

// All subsequent routes require authenticated user session
router.use(authenticate);

// =====================================================================
// 2. New Hire Listing & Details
// =====================================================================
router.get(
  '/new-hires',
  authorize(['onboarding:read', 'employee:read']),
  onboardingController.getNewHires
);

router.get(
  '/new-hires/:id',
  authorize(['onboarding:read', 'employee:read']),
  onboardingController.getNewHireById
);

// Alias /:id to get single new hire
router.get(
  '/:id',
  authorize(['onboarding:read', 'employee:read']),
  onboardingController.getNewHireById
);

// =====================================================================
// 3. Status & Progress Checklist APIs
// =====================================================================
// GET /api/v1/onboarding/:id/status
router.get(
  '/:id/status',
  authorize(['onboarding:read', 'employee:read']),
  onboardingController.getOnboardingStatus
);

router.get(
  '/new-hires/:id/status',
  authorize(['onboarding:read', 'employee:read']),
  onboardingController.getOnboardingStatus
);

// PATCH /api/v1/onboarding/:id/checklist
router.patch(
  '/:id/checklist',
  authorize(['onboarding:write']),
  validate(validateChecklistUpdate),
  onboardingController.updateChecklist
);

router.patch(
  '/new-hires/:id/checklist',
  authorize(['onboarding:write']),
  validate(validateChecklistUpdate),
  onboardingController.updateChecklist
);

// =====================================================================
// 4. Document Processing APIs
// =====================================================================
// POST /api/v1/onboarding/:id/documents/upload
router.post(
  '/:id/documents/upload',
  authorize(['onboarding:write', 'document:write']),
  uploadSingleDocument('file'),
  validate(validateDocumentUploadMetadata),
  onboardingController.uploadDocument
);

router.post(
  '/new-hires/:id/documents/upload',
  authorize(['onboarding:write', 'document:write']),
  uploadSingleDocument('file'),
  validate(validateDocumentUploadMetadata),
  onboardingController.uploadDocument
);

// PATCH /api/v1/onboarding/documents/:docId/verify
router.patch(
  '/documents/:docId/verify',
  authorize(['onboarding:verify', 'document:write', 'onboarding:write']),
  validate(validateVerifyDocument),
  onboardingController.verifyDocument
);

// =====================================================================
// 5. IT / Access Setup Provisioning Status APIs
// =====================================================================
// GET /api/v1/onboarding/:id/it-setup
router.get(
  '/:id/it-setup',
  authorize(['it:write', 'onboarding:read', 'onboarding:write']),
  onboardingController.getItSetup
);

router.get(
  '/new-hires/:id/it-setup',
  authorize(['it:write', 'onboarding:read', 'onboarding:write']),
  onboardingController.getItSetup
);

// PATCH /api/v1/onboarding/:id/it-setup
router.patch(
  '/:id/it-setup',
  authorize(['it:write', 'onboarding:write']),
  validate(validateItSetupUpdate),
  onboardingController.updateItSetup
);

router.patch(
  '/new-hires/:id/it-setup',
  authorize(['it:write', 'onboarding:write']),
  validate(validateItSetupUpdate),
  onboardingController.updateItSetup
);

// =====================================================================
// 6. Day-1 Conversion API
// =====================================================================
// POST /api/v1/onboarding/:id/convert-to-employee
router.post(
  '/:id/convert-to-employee',
  authorize(['onboarding:write', 'employee:write']),
  validate(validateConvertToEmployee),
  onboardingController.convertToEmployee
);

router.post(
  '/new-hires/:id/convert-to-employee',
  authorize(['onboarding:write', 'employee:write']),
  validate(validateConvertToEmployee),
  onboardingController.convertToEmployee
);

// =====================================================================
// 7. Backward-Compatible Lifecycle Transitions
// =====================================================================
router.post(
  '/new-hires/:id/initiate',
  authorize(['onboarding:write']),
  onboardingController.initiateOnboarding
);

router.put(
  '/new-hires/:id/readiness',
  authorize(['onboarding:write']),
  validate(validateReadinessUpdate),
  onboardingController.updateChecklist
);

router.put(
  '/new-hires/:id/bgv',
  authorize(['onboarding:write']),
  validate(validateBgvUpdate),
  onboardingController.updateBgv
);

export default router;
