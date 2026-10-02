import { Router } from 'express';
import { engagementController } from '../controllers/engagementController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';

const router = Router();

router.use(authenticate);

// Announcements
router.get('/announcements', authorize(['engagement:read', 'employee:read']), engagementController.listAnnouncements);
router.post('/announcements', authorize(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'hr', 'hrmanager', 'admin', 'superadmin', 'orgadmin']), engagementController.createAnnouncement);
router.post('/announcements/:id/read', authorize(['engagement:read', 'employee:read']), engagementController.markAsRead);

// Surveys
router.get('/surveys', authorize(['engagement:read', 'employee:read']), engagementController.listSurveys);
router.post('/surveys', authorize(['HR', 'Admin', 'SuperAdmin', 'HRManager', 'hr', 'hrmanager', 'admin', 'superadmin', 'orgadmin']), engagementController.createSurvey);
router.post('/surveys/:id/respond', authorize(['engagement:read', 'employee:read']), engagementController.submitSurveyResponse);

// Peer Recognition (Kudos)
router.get('/recognitions', authorize(['engagement:read', 'employee:read']), engagementController.listRecognitions);
router.post('/recognitions', authorize(['engagement:write', 'employee:read']), engagementController.giveRecognition);

export default router;

