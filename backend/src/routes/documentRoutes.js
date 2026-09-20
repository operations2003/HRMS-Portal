import { Router } from 'express';
import { documentController } from '../controllers/documentController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { uploadSingleDocument } from '../middleware/uploadMiddleware.js';
import { validateAddDocument, validateVerifyDocument } from '../validators/documentValidator.js';

const router = Router();

// All document routes require authentication
router.use(authenticate);

// 1. Employee Self-Service (IDOR protected)
router.get('/my', documentController.getMyDocuments);
router.post('/my/upload', uploadSingleDocument('file'), documentController.uploadMyDocument);

// 2. Document CRUD, Download & Querying
router.get('/', authorize(['document:read', 'employee:read']), documentController.getAllDocuments);
router.post('/', authorize('document:write'), validate(validateAddDocument), documentController.addDocument);
router.post('/owner/:ownerType/:ownerId/upload', authorize('document:write'), uploadSingleDocument('file'), documentController.uploadDocumentForOwner);
router.get('/owner/:ownerType/:ownerId', authorize(['document:read', 'employee:read']), documentController.getDocumentsByOwner);
router.get('/:id/download', documentController.downloadDocument);
router.get('/:id', authorize(['document:read', 'employee:read']), documentController.getDocumentById);
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

