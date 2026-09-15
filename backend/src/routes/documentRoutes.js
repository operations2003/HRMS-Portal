import { Router } from 'express';
import { documentController } from '../controllers/documentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateAddDocument, validateVerifyDocument } from '../validators/documentValidator.js';

const router = Router();

// All document routes require authentication
router.use(authenticate);

// Document CRUD & Querying
router.post('/', authorize('document:write'), validate(validateAddDocument), documentController.addDocument);
router.get('/owner/:ownerType/:ownerId', authorize('document:read'), documentController.getDocumentsByOwner);
router.get('/:id', authorize('document:read'), documentController.getDocumentById);
router.delete('/:id', authorize('document:write'), documentController.deleteDocument);

// Document Verification Workflow
router.patch(
  '/:id/verify',
  authorize('document:write'),
  validate(validateVerifyDocument),
  documentController.verifyDocument
);

// Document Acknowledgement
router.post('/:id/acknowledge', documentController.acknowledgeDocument);

// Document Versioning
router.post('/:id/version', authorize('document:write'), documentController.createNewVersion);

export default router;

