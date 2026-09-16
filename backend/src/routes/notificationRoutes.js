import { Router } from 'express';
import { notificationController } from '../controllers/notificationController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize } from '../middleware/rbacMiddleware.js';
import { validate } from '../middleware/validateMiddleware.js';
import { validateCreateNotification } from '../validators/notificationValidator.js';

const router = Router();

// Authentication required for all notification routes
router.use(authenticate);

// =====================================================================
// User Notification Endpoints (Self-Service)
// =====================================================================
router.get('/', authorize('notification:read'), notificationController.getMyNotifications);
router.get('/unread-count', authorize('notification:read'), notificationController.getUnreadCount);
router.post('/mark-all-read', authorize('notification:read'), notificationController.markAllAsRead);
router.patch('/mark-all-read', authorize('notification:read'), notificationController.markAllAsRead);
router.patch('/:id/read', authorize('notification:read'), notificationController.markAsRead);
router.patch('/:id/unread', authorize('notification:read'), notificationController.markAsUnread);

// =====================================================================
// System / Staff Notification Dispatch
// =====================================================================
router.post(
  '/',
  authorize('notification:write'),
  validate(validateCreateNotification),
  notificationController.createNotification
);

export default router;
