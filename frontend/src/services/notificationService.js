import { http } from './api.js';

export const notificationService = {
  /**
   * Get paginated notifications for current user
   */
  async getNotifications(params = {}) {
    const res = await http.get('/v1/notifications', { params });
    return res.data;
  },

  /**
   * Get unread notification count
   */
  async getUnreadCount() {
    const res = await http.get('/v1/notifications/unread-count');
    return res.data?.unreadCount || 0;
  },

  /**
   * Mark a single notification as read
   */
  async markAsRead(id) {
    const res = await http.patch(`/v1/notifications/${id}/read`);
    return res.data;
  },

  /**
   * Mark a single notification as unread
   */
  async markAsUnread(id) {
    const res = await http.patch(`/v1/notifications/${id}/unread`);
    return res.data;
  },

  /**
   * Mark all notifications as read for current user
   */
  async markAllAsRead() {
    const res = await http.post('/v1/notifications/mark-all-read');
    return res.data;
  },
};

export default notificationService;
