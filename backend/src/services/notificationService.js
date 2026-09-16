import { notificationRepository } from '../repositories/notificationRepository.js';
import { logger } from '../utils/logger.js';

export const notificationService = {
  /**
   * Fetch paginated notifications for authenticated user
   */
  async getUserNotifications(userId, options = {}) {
    return notificationRepository.findByUser(userId, options);
  },

  /**
   * Get total unread count for user
   */
  async getUnreadCount(userId) {
    return notificationRepository.countUnread(userId);
  },

  /**
   * Mark a single notification as read
   */
  async markNotificationRead(notificationId, userId) {
    const updated = await notificationRepository.markAsRead(notificationId, userId);
    if (!updated) {
      const err = new Error('Notification not found or access denied.');
      err.statusCode = 404;
      throw err;
    }
    return updated;
  },

  /**
   * Mark a single notification as unread
   */
  async markNotificationUnread(notificationId, userId) {
    const updated = await notificationRepository.markAsUnread(notificationId, userId);
    if (!updated) {
      const err = new Error('Notification not found or access denied.');
      err.statusCode = 404;
      throw err;
    }
    return updated;
  },

  /**
   * Mark all notifications as read
   */
  async markAllNotificationsRead(userId) {
    return notificationRepository.markAllAsRead(userId);
  },

  /**
   * Create system or custom notification
   */
  async createSystemNotification({ orgId, userId, eventType = 'GENERAL_ALERT', title, message, entityType = 'GENERAL', entityId = 'system', actionUrl = '' }) {
    if (!userId || !title || !message) {
      const err = new Error('User ID, title, and message are required.');
      err.statusCode = 400;
      throw err;
    }

    return notificationRepository.create({
      orgId: orgId || 'org-1',
      userId,
      eventType,
      title,
      message,
      entityType,
      entityId,
      actionUrl,
    });
  },

  // =========================================================================
  // Phase 5 Domain Event Dispatchers (Payroll, Payslips, Helpdesk, Requests)
  // =========================================================================

  /**
   * 1. Event: Payroll Processed
   */
  async notifyPayrollProcessed({ orgId, periodId, periodName, userIds = [] }) {
    if (!userIds || userIds.length === 0) return [];

    logger.info('NotificationService', `Dispatching PAYROLL_PROCESSED for period ${periodName} to ${userIds.length} users`);

    const notifications = userIds.map((userId) => ({
      orgId,
      userId,
      eventType: 'PAYROLL_PROCESSED',
      title: `Payroll Processed for ${periodName}`,
      message: `The payroll cycle for ${periodName} has been processed successfully.`,
      entityType: 'PAYROLL_PERIOD',
      entityId: periodId,
      actionUrl: '/payroll',
    }));

    return notificationRepository.createBatch(notifications);
  },

  /**
   * 2. Event: Payslip Available
   */
  async notifyPayslipAvailable({ orgId, userId, payslipNumber, periodName, payslipId }) {
    if (!userId) return null;

    logger.info('NotificationService', `Dispatching PAYSLIP_AVAILABLE for payslip ${payslipNumber} to user ${userId}`);

    return notificationRepository.create({
      orgId,
      userId,
      eventType: 'PAYSLIP_AVAILABLE',
      title: `Payslip Available: ${periodName}`,
      message: `Your payslip ${payslipNumber} for ${periodName} is now ready for view and download.`,
      entityType: 'PAYSLIP',
      entityId: payslipId,
      actionUrl: `/payslips/${payslipId}`,
    });
  },

  /**
   * 3. Event: Helpdesk Ticket Created
   */
  async notifyTicketCreated({ orgId, ticketId, ticketNumber, subject, requesterUserId, assigneeUserId = null }) {
    const notifications = [];

    // Notification to requester (acknowledgement)
    if (requesterUserId) {
      notifications.push({
        orgId,
        userId: requesterUserId,
        eventType: 'TICKET_CREATED',
        title: `Ticket Submitted: ${ticketNumber}`,
        message: `Your ticket "${subject}" has been received and queued for review.`,
        entityType: 'HELPDESK_TICKET',
        entityId: ticketId,
        actionUrl: `/helpdesk/${ticketId}`,
      });
    }

    // Notification to assigned agent if designated
    if (assigneeUserId && assigneeUserId !== requesterUserId) {
      notifications.push({
        orgId,
        userId: assigneeUserId,
        eventType: 'TICKET_CREATED',
        title: `Ticket Assigned: ${ticketNumber}`,
        message: `You have been assigned ticket "${subject}".`,
        entityType: 'HELPDESK_TICKET',
        entityId: ticketId,
        actionUrl: `/helpdesk/${ticketId}`,
      });
    }

    return notificationRepository.createBatch(notifications);
  },

  /**
   * 4. Event: Helpdesk Ticket Status Changed
   */
  async notifyTicketStatusChanged({ orgId, ticketId, ticketNumber, subject, newStatus, recipientUserId }) {
    if (!recipientUserId) return null;

    logger.info('NotificationService', `Dispatching TICKET_STATUS_CHANGED for ${ticketNumber} (${newStatus}) to user ${recipientUserId}`);

    return notificationRepository.create({
      orgId,
      userId: recipientUserId,
      eventType: 'TICKET_STATUS_CHANGED',
      title: `Ticket ${newStatus}: ${ticketNumber}`,
      message: `The status of ticket "${subject}" has been updated to ${newStatus}.`,
      entityType: 'HELPDESK_TICKET',
      entityId: ticketId,
      actionUrl: `/helpdesk/${ticketId}`,
    });
  },

  /**
   * 5. Event: Employee Request Created
   */
  async notifyRequestCreated({ orgId, requestId, requestNumber, subject, requesterUserId, assigneeUserId = null }) {
    const notifications = [];

    if (requesterUserId) {
      notifications.push({
        orgId,
        userId: requesterUserId,
        eventType: 'EMPLOYEE_REQUEST_CREATED',
        title: `Service Request Submitted: ${requestNumber}`,
        message: `Your service request "${subject}" has been registered.`,
        entityType: 'EMPLOYEE_REQUEST',
        entityId: requestId,
        actionUrl: `/requests/${requestId}`,
      });
    }

    if (assigneeUserId && assigneeUserId !== requesterUserId) {
      notifications.push({
        orgId,
        userId: assigneeUserId,
        eventType: 'EMPLOYEE_REQUEST_CREATED',
        title: `Service Request Assigned: ${requestNumber}`,
        message: `A new service request "${subject}" is assigned to you.`,
        entityType: 'EMPLOYEE_REQUEST',
        entityId: requestId,
        actionUrl: `/requests/${requestId}`,
      });
    }

    return notificationRepository.createBatch(notifications);
  },

  /**
   * 6. Event: Employee Request Status Changed
   */
  async notifyRequestStatusChanged({ orgId, requestId, requestNumber, subject, newStatus, recipientUserId }) {
    if (!recipientUserId) return null;

    logger.info('NotificationService', `Dispatching EMPLOYEE_REQUEST_STATUS_CHANGED for ${requestNumber} (${newStatus}) to user ${recipientUserId}`);

    return notificationRepository.create({
      orgId,
      userId: recipientUserId,
      eventType: 'EMPLOYEE_REQUEST_STATUS_CHANGED',
      title: `Request ${newStatus}: ${requestNumber}`,
      message: `Your service request "${subject}" has been updated to ${newStatus}.`,
      entityType: 'EMPLOYEE_REQUEST',
      entityId: requestId,
      actionUrl: `/requests/${requestId}`,
    });
  },
};

export default notificationService;

