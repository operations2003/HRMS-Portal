import { Router } from 'express';
import { atsIntegrationController } from '../controllers/atsIntegrationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateAtsHandoff } from '../validators/atsValidator.js';

const router = Router();

/**
 * Middleware to allow either standard JWT authentication OR ATS Integration Secret Key (Portal 2 Webhook)
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

  // Fallback to standard Bearer token authentication
  return authenticate(req, res, next);
};

// ATS Handoff Endpoint (Ingests candidate from ATS Portal 2)
router.post(
  '/handoff',
  authenticateAtsOrUser,
  authorize(['ats:integrate', 'onboarding:write', 'employee:write']),
  validate(validateAtsHandoff),
  atsIntegrationController.handleCandidateHandoff
);

// ATS Candidate Status Check
router.get(
  '/status/:atsCandidateId',
  authenticateAtsOrUser,
  authorize(['ats:integrate', 'onboarding:read', 'employee:read']),
  atsIntegrationController.getCandidateHandoffStatus
);

export default router;

