import { notificationService } from '../services/notificationService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const notificationController = {
  /**
   * GET /api/v1/notifications
   * Get current user's paginated notifications
   */
  async getMyNotifications(req, res, next) {
    try {
      const { limit = 20, offset = 0, unreadOnly } = req.query;
      const notifications = await notificationService.getUserNotifications(req.user.id, {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        unreadOnly: unreadOnly === 'true' || unreadOnly === true,
      });

      const unreadCount = await notificationService.getUnreadCount(req.user.id);

      return sendSuccess(res, 'Notifications retrieved successfully.', {
        items: notifications,
        unreadCount,
      });
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * GET /api/v1/notifications/unread-count
   */
  async getUnreadCount(req, res, next) {
    try {
      const count = await notificationService.getUnreadCount(req.user.id);
      return sendSuccess(res, 'Unread notification count retrieved.', { unreadCount: count });
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/notifications/:id/read
   */
  async markAsRead(req, res, next) {
    try {
      const notification = await notificationService.markNotificationRead(req.params.id, req.user.id);
      return sendSuccess(res, 'Notification marked as read.', notification);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * PATCH /api/v1/notifications/:id/unread
   */
  async markAsUnread(req, res, next) {
    try {
      const notification = await notificationService.markNotificationUnread(req.params.id, req.user.id);
      return sendSuccess(res, 'Notification marked as unread.', notification);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/notifications/mark-all-read
   */
  async markAllAsRead(req, res, next) {
    try {
      const count = await notificationService.markAllNotificationsRead(req.user.id);
      return sendSuccess(res, 'All notifications marked as read.', { updatedCount: count });
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },

  /**
   * POST /api/v1/notifications
   * Create system/custom notification
   */
  async createNotification(req, res, next) {
    try {
      const notification = await notificationService.createSystemNotification({
        orgId: req.user.orgId,
        ...req.body,
      });
      return sendSuccess(res, 'Notification created successfully.', notification, 201);
    } catch (error) {
      if (error.statusCode) return sendError(res, error.message, error.statusCode);
      next(error);
    }
  },
};

export default notificationController;
