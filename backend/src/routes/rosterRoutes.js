import { Router } from 'express';
import rosterController from '../controllers/rosterController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { uploadSingleDocument } from '../middleware/uploadMiddleware.js';

const router = Router();

// Authentication required for all roster routes
router.use(authenticate);

// Get shift assignments for employees (Employee: self, Manager: team, HR/Admin: all)
router.get(
  '/assignments',
  authorize(['employee:read', 'attendance:read', 'team:read']),
  rosterController.getAssignments
);

// Admin & HR management routes (upload, preview, resolve, confirm, history)
router.post(
  '/upload',
  authorize(['employee:write', 'attendance:write']),
  uploadSingleDocument('roster'),
  rosterController.uploadRoster
);

router.get(
  '/preview/:jobId',
  authorize(['employee:write', 'attendance:write']),
  rosterController.getPreview
);

router.post(
  '/resolve-ambiguity',
  authorize(['employee:write', 'attendance:write']),
  rosterController.resolveAmbiguity
);

router.post(
  '/ai-auto-resolve/:jobId',
  authorize(['employee:write', 'attendance:write']),
  rosterController.aiAutoResolve
);

router.post(
  '/confirm/:jobId',
  authorize(['employee:write', 'attendance:write']),
  rosterController.confirmImport
);

router.post(
  '/cell-override/:jobId',
  authorize(['employee:write', 'attendance:write']),
  rosterController.overrideCell
);

router.put(
  '/assignment',
  authorize(['employee:write', 'attendance:write']),
  rosterController.updateAssignment
);

router.get(
  '/history',
  authorize(['employee:write', 'attendance:write']),
  rosterController.getImportHistory
);

export default router;
