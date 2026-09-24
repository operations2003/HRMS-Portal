import { notificationRepository } from '../repositories/notificationRepository.js';
import { userRepository } from '../repositories/userRepository.js';
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
  async createNotification(params) {
    return this.createSystemNotification(params);
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
  // Domain Event Dispatchers (Helpdesk, Requests, Workflows, Exit, etc.)
  // =========================================================================

  /**
   * 1. Event: Helpdesk Ticket Created
   */
  async notifyTicketCreated({ orgId, ticketId, ticketNumber, subject, requesterUserId, requesterName = '', assigneeUserId = null }) {
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

    // Notification to assigned Manager / HR / Admin
    if (assigneeUserId && assigneeUserId !== requesterUserId) {
      notifications.push({
        orgId,
        userId: assigneeUserId,
        eventType: 'TICKET_CREATED',
        title: `New Help Desk Ticket: ${ticketNumber}`,
        message: requesterName
          ? `New ticket "${subject}" submitted by ${requesterName} is assigned to you.`
          : `Ticket "${subject}" has been assigned to you for resolution/checking.`,
        entityType: 'HELPDESK_TICKET',
        entityId: ticketId,
        actionUrl: `/helpdesk/${ticketId}`,
      });
    }

    // Notification to relevant authorized Help Desk staff
    try {
      const allUsers = await userRepository.findAll();
      const notifiedUserIds = new Set([requesterUserId, assigneeUserId].filter(Boolean));

      for (const u of allUsers) {
        if (!u || !u.id || notifiedUserIds.has(u.id)) continue;
        if (u.status !== 'Active') continue;
        if (u.orgId && u.orgId !== orgId && u.orgId !== 'org-1' && orgId !== 'org-1') continue;

        const roleStr =
          u.roleName ||
          (typeof u.role === 'string' ? u.role : u.role?.name) ||
          u.roleId ||
          '';
        const normRole = roleStr.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isStaffRole = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole);
        const hasManagePerm =
          Array.isArray(u.permissions) &&
          (u.permissions.includes('helpdesk:manage') || u.permissions.includes('request:manage'));

        if (isStaffRole || hasManagePerm) {
          notifications.push({
            orgId: u.orgId || orgId,
            userId: u.id,
            eventType: 'TICKET_CREATED',
            title: `New Help Desk Ticket: ${ticketNumber}`,
            message: requesterName
              ? `New ticket "${subject}" submitted by ${requesterName}.`
              : `New ticket "${subject}" has been submitted for review.`,
            entityType: 'HELPDESK_TICKET',
            entityId: ticketId,
            actionUrl: `/helpdesk/${ticketId}`,
          });
          notifiedUserIds.add(u.id);
        }
      }
    } catch (e) {
      logger.warn('NotificationService', `Could not dispatch staff notifications for ticket ${ticketNumber}: ${e.message}`);
    }

    return notificationRepository.createBatch(notifications);
  },

  /**
   * 2. Event: Helpdesk Ticket Assigned / Re-assigned
   */
  async notifyTicketAssigned({ orgId, ticketId, ticketNumber, subject, assigneeUserId, assignedByName = '' }) {
    if (!assigneeUserId) return null;

    logger.info('NotificationService', `Dispatching ticket assignment for ${ticketNumber} to user ${assigneeUserId}`);

    return notificationRepository.create({
      orgId,
      userId: assigneeUserId,
      eventType: 'TICKET_STATUS_CHANGED',
      title: `Ticket Action Required: ${ticketNumber}`,
      message: assignedByName
        ? `Ticket "${subject}" has been assigned to you by ${assignedByName} for resolution/checking.`
        : `Ticket "${subject}" has been assigned to you for resolution/checking.`,
      entityType: 'HELPDESK_TICKET',
      entityId: ticketId,
      actionUrl: `/helpdesk/${ticketId}`,
    });
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

  // =========================================================================
  // Phase 6 Domain Event Dispatchers (Performance, Leaves, Manager, HR)
  // =========================================================================

  /**
   * 7. Event: Performance Review Pending Manager Evaluation
   */
  async notifyPerformanceSubmitted({ orgId, appraisalId, reviewPeriod, employeeName, reviewerUserId }) {
    if (!reviewerUserId) return null;

    logger.info('NotificationService', `Dispatching PERFORMANCE_REVIEW_PENDING for ${reviewPeriod} (${employeeName}) to reviewer ${reviewerUserId}`);

    return notificationRepository.create({
      orgId,
      userId: reviewerUserId,
      eventType: 'PERFORMANCE_REVIEW_PENDING',
      title: 'Performance Review Awaiting Your Evaluation',
      message: `${employeeName || 'An employee'} has submitted their performance self-review for ${reviewPeriod}.`,
      entityType: 'PERFORMANCE_REVIEW',
      entityId: appraisalId,
      actionUrl: `/performance/${appraisalId}`,
    });
  },

  /**
   * 8. Event: Performance Review Approved (HR Final Sign-off)
   */
  async notifyPerformanceApproved({ orgId, appraisalId, reviewPeriod, employeeUserId, rating }) {
    if (!employeeUserId) return null;

    logger.info('NotificationService', `Dispatching PERFORMANCE_APPROVED for ${reviewPeriod} to user ${employeeUserId}`);

    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'PERFORMANCE_APPROVED',
      title: 'Performance Review Approved',
      message: `Your performance review for ${reviewPeriod} has been approved by HR. Final Rating: ${rating || 'N/A'}/5.0`,
      entityType: 'PERFORMANCE_REVIEW',
      entityId: appraisalId,
      actionUrl: `/performance/${appraisalId}`,
    });
  },

  /**
   * 9. Event: Performance Review Returned for Revision
   */
  async notifyPerformanceReturned({ orgId, appraisalId, reviewPeriod, employeeUserId, reason }) {
    if (!employeeUserId) return null;

    logger.info('NotificationService', `Dispatching PERFORMANCE_RETURNED for ${reviewPeriod} to user ${employeeUserId}`);

    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'PERFORMANCE_RETURNED',
      title: 'Performance Review Returned for Revision',
      message: `Your review for ${reviewPeriod} was returned: "${reason}". Please revise and resubmit.`,
      entityType: 'PERFORMANCE_REVIEW',
      entityId: appraisalId,
      actionUrl: `/performance/${appraisalId}`,
    });
  },

  /**
   * 10. Event: Performance Review Rejected
   */
  async notifyPerformanceRejected({ orgId, appraisalId, reviewPeriod, employeeUserId, reason }) {
    if (!employeeUserId) return null;

    logger.info('NotificationService', `Dispatching PERFORMANCE_REJECTED for ${reviewPeriod} to user ${employeeUserId}`);

    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'PERFORMANCE_REJECTED',
      title: 'Performance Review Rejected',
      message: `Your review for ${reviewPeriod} was rejected: "${reason}".`,
      entityType: 'PERFORMANCE_REVIEW',
      entityId: appraisalId,
      actionUrl: `/performance/${appraisalId}`,
    });
  },

  /**
   * 11. Event: Leave Approval Pending (Notification to Manager)
   */
  async notifyLeaveApprovalPending({ orgId, leaveId, employeeName, startDate, endDate, managerUserId }) {
    if (!managerUserId) return null;

    logger.info('NotificationService', `Dispatching LEAVE_APPROVAL_PENDING for ${employeeName} to manager ${managerUserId}`);

    return notificationRepository.create({
      orgId,
      userId: managerUserId,
      eventType: 'LEAVE_APPROVAL_PENDING',
      title: 'Leave Request Pending Your Approval',
      message: `${employeeName || 'A team member'} has applied for leave from ${startDate} to ${endDate}.`,
      entityType: 'LEAVE_REQUEST',
      entityId: leaveId,
      actionUrl: '/approvals',
    });
  },

  /**
   * 12. Event: Leave Request Approved
   */
  async notifyLeaveApproved({ orgId, leaveId, startDate, endDate, employeeUserId, comments }) {
    if (!employeeUserId) return null;

    logger.info('NotificationService', `Dispatching LEAVE_APPROVED for leave ${leaveId} to user ${employeeUserId}`);

    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'LEAVE_APPROVED',
      title: 'Leave Request Approved',
      message: `Your leave request from ${startDate} to ${endDate} has been approved.${comments ? ` Note: "${comments}"` : ''}`,
      entityType: 'LEAVE_REQUEST',
      entityId: leaveId,
      actionUrl: '/leaves',
    });
  },

  /**
   * 13. Event: Leave Request Rejected
   */
  async notifyLeaveRejected({ orgId, leaveId, startDate, endDate, employeeUserId, reason }) {
    if (!employeeUserId) return null;

    logger.info('NotificationService', `Dispatching LEAVE_REJECTED for leave ${leaveId} to user ${employeeUserId}`);

    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'LEAVE_REJECTED',
      title: 'Leave Request Rejected',
      message: `Your leave request from ${startDate} to ${endDate} was rejected: "${reason}".`,
      entityType: 'LEAVE_REQUEST',
      entityId: leaveId,
      actionUrl: '/leaves',
    });
  },

  /**
   * 14. Event: Manager Assigned to Employee
   */
  async notifyManagerAssigned({ orgId, employeeName, managerName, employeeUserId, managerUserId }) {
    const notifications = [];

    if (employeeUserId) {
      notifications.push({
        orgId,
        userId: employeeUserId,
        eventType: 'MANAGER_ASSIGNED',
        title: 'Reporting Manager Assigned',
        message: `${managerName || 'A manager'} is now assigned as your reporting manager.`,
        entityType: 'TEAM',
        entityId: 'manager_assignment',
        actionUrl: '/dashboard',
      });
    }

    if (managerUserId) {
      notifications.push({
        orgId,
        userId: managerUserId,
        eventType: 'MANAGER_ASSIGNED',
        title: 'New Direct Report Assigned',
        message: `${employeeName || 'A new member'} has been assigned to your team roster.`,
        entityType: 'TEAM',
        entityId: 'team_assignment',
        actionUrl: '/team',
      });
    }

    if (notifications.length === 0) return [];
    return notificationRepository.createBatch(notifications);
  },

  // =========================================================================
  // Phase 7 Domain Event Dispatchers (Exit & Offboarding Lifecycle)
  // =========================================================================

  /**
   * 15. Event: Resignation Submitted (to Manager)
   */
  async notifyResignationSubmitted({ orgId, exitId, employeeName, managerUserId }) {
    if (!managerUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: managerUserId,
      eventType: 'RESIGNATION_SUBMITTED',
      title: 'Team Resignation Submitted',
      message: `${employeeName || 'A team member'} has submitted their resignation. Please review.`,
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}`,
    });
  },

  /**
   * 16. Event: Exit Review Pending (to HR)
   */
  async notifyExitReviewPending({ orgId, exitId, employeeName, hrUserIds = [] }) {
    if (!hrUserIds || hrUserIds.length === 0) return [];
    const notifications = hrUserIds.map((userId) => ({
      orgId,
      userId,
      eventType: 'EXIT_REVIEW_PENDING',
      title: 'Resignation Pending HR Review',
      message: `${employeeName || 'An employee'} has been reviewed by their manager and requires HR approval.`,
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}`,
    }));
    return notificationRepository.createBatch(notifications);
  },

  /**
   * 17. Event: Exit Approved (to Exiting Employee)
   */
  async notifyExitApproved({ orgId, exitId, approvedLwd, employeeUserId }) {
    if (!employeeUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'EXIT_APPROVED',
      title: 'Resignation Approved - Notice Period Active',
      message: `Your resignation has been approved. Your approved last working day is ${approvedLwd}. Departmental clearance tasks are now active.`,
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}`,
    });
  },

  /**
   * 18. Event: Exit Rejected (to Exiting Employee)
   */
  async notifyExitRejected({ orgId, exitId, reason, employeeUserId }) {
    if (!employeeUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'EXIT_REJECTED',
      title: 'Resignation Request Rejected',
      message: `Your resignation request has been rejected: "${reason}".`,
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}`,
    });
  },

  /**
   * 19. Event: Clearance Task Assigned (to Department / Assignee)
   */
  async notifyClearanceTaskAssigned({ orgId, taskId, taskTitle, assignedToUserId, employeeName }) {
    if (!assignedToUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: assignedToUserId,
      eventType: 'CLEARANCE_TASK_ASSIGNED',
      title: 'Exit Clearance Task Assigned',
      message: `You have been assigned clearance task "${taskTitle}" for exiting employee ${employeeName || 'staff'}.`,
      entityType: 'EXIT_CLEARANCE',
      entityId: taskId,
      actionUrl: `/exit/clearances/${taskId}`,
    });
  },

  /**
   * 20. Event: Deprovisioning Executed (to Exiting Employee)
   */
  async notifyDeprovisioningExecuted({ orgId, exitId, employeeUserId }) {
    if (!employeeUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'DEPROVISIONING_EXECUTED',
      title: 'System Access Deprovisioned',
      message: 'Your system access credentials have been deactivated as part of your exit handover.',
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}`,
    });
  },

  /**
   * 21. Event: Full & Final Settlement Processed
   */
  async notifyFnfSettlementProcessed({ orgId, exitId, employeeUserId, netAmount }) {
    if (!employeeUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'FNF_SETTLEMENT_PROCESSED',
      title: 'Full & Final Settlement Ready',
      message: `Your Full & Final settlement has been processed with net amount ₹${Number(netAmount).toLocaleString()}.`,
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}/fnf`,
    });
  },

  /**
   * 22. Event: Exit Completed
   */
  async notifyExitCompleted({ orgId, exitId, employeeUserId }) {
    if (!employeeUserId) return null;
    return notificationRepository.create({
      orgId,
      userId: employeeUserId,
      eventType: 'EXIT_COMPLETED',
      title: 'Exit Formalities Completed',
      message: 'All offboarding, departmental clearances, and final settlements have been successfully concluded.',
      entityType: 'EXIT_REQUEST',
      entityId: exitId,
      actionUrl: `/exit/${exitId}`,
    });
  },
};

export default notificationService;


