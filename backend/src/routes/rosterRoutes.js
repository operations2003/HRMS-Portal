import { Router } from 'express';
import rosterController from '../controllers/rosterController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { uploadSingleDocument } from '../middleware/uploadMiddleware.js';

const router = Router();

// All roster routes require authentication and employee:write permission (Admin/HR only)
router.use(authenticate);
router.use(authorize('employee:write'));

// Upload and parse roster file (preview mode)
router.post('/upload', uploadSingleDocument('roster'), rosterController.uploadRoster);

// Get preview of uploaded roster
router.get('/preview/:jobId', rosterController.getPreview);

// Resolve ambiguous employee mapping
router.post('/resolve-ambiguity', rosterController.resolveAmbiguity);

// Confirm and apply roster import
router.post('/confirm/:jobId', rosterController.confirmImport);

// Get roster import history
router.get('/history', rosterController.getImportHistory);

// Get shift assignments for employees
router.get('/assignments', rosterController.getAssignments);

export default router;
