import { Router } from 'express';
import { onboardingController } from '../controllers/onboardingController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateReadinessUpdate,
  validateBgvUpdate,
  validateConvertToEmployee,
} from '../validators/onboardingValidator.js';

const router = Router();

// All onboarding routes require authentication
router.use(authenticate);

// Listing & Details
router.get('/new-hires', authorize('onboarding:read'), onboardingController.getNewHires);
router.get('/new-hires/:id', authorize('onboarding:read'), onboardingController.getNewHireById);

// Lifecycle Transitions
router.post('/new-hires/:id/initiate', authorize('onboarding:write'), onboardingController.initiateOnboarding);
router.put(
  '/new-hires/:id/readiness',
  authorize('onboarding:write'),
  validate(validateReadinessUpdate),
  onboardingController.updateReadiness
);
router.put(
  '/new-hires/:id/bgv',
  authorize('onboarding:write'),
  validate(validateBgvUpdate),
  onboardingController.updateBgv
);
router.post(
  '/new-hires/:id/convert-to-employee',
  authorize('onboarding:write'),
  validate(validateConvertToEmployee),
  onboardingController.convertToEmployee
);

export default router;

