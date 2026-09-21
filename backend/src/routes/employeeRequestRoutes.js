import { Router } from 'express';
import { employeeRequestController } from '../controllers/employeeRequestController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import {
  validateCreateRequest,
  validateAddRequestUpdate,
  validateAssignRequest,
  validateUpdateRequestStatus,
  validateResolveRequest,
  validateRejectRequest,
} from '../validators/employeeRequestValidator.js';

const router = Router();

// Authentication required for all employee request routes
router.use(authenticate);

// =====================================================================
// 1. Employee Own Requests (Self-Service with IDOR Guard)
// =====================================================================
router.get('/my', authorize('request:read'), employeeRequestController.getMyRequests);
router.post(
  '/',
  authorize('request:write'),
  validate(validateCreateRequest),
  employeeRequestController.createRequest
);
router.post(
  '/:id/updates',
  authorize('request:write'),
  validate(validateAddRequestUpdate),
  employeeRequestController.addUpdate
);
router.post(
  '/:id/cancel',
  authorize('request:write'),
  employeeRequestController.cancelRequest
);

// =====================================================================
// 2. Request Retrieval & Stats
// =====================================================================
router.get('/stats', authorize('request:read'), employeeRequestController.getStats);
router.get('/', authorize('request:read'), employeeRequestController.listRequests);
router.get('/:id', authorize('request:read'), employeeRequestController.getRequestById);

// =====================================================================
// 3. HR / Admin Management
// =====================================================================
router.post(
  '/:id/assign',
  authorize('request:manage'),
  validate(validateAssignRequest),
  employeeRequestController.assignRequest
);
router.patch(
  '/:id/status',
  authorize(['request:manage', 'Manager', 'HR', 'Admin']),
  validate(validateUpdateRequestStatus),
  employeeRequestController.updateStatus
);
router.post(
  '/:id/resolve',
  authorize(['request:manage', 'Manager', 'HR', 'Admin']),
  validate(validateResolveRequest),
  employeeRequestController.resolveRequest
);
router.post(
  '/:id/reject',
  authorize(['request:manage', 'Manager', 'HR', 'Admin']),
  validate(validateRejectRequest),
  employeeRequestController.rejectRequest
);

export default router;
