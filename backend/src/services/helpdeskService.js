import { helpdeskRepository } from '../repositories/helpdeskRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { notificationService } from './notificationService.js';

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const HR_ADMIN_ROLES = ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'];

export const helpdeskService = {
  /**
   * Resolve employee record for logged-in user
   */
  async resolveEmployee(user) {
    const orgId = user.orgId || 'org-1';
    const employee = await employeeRepository.findByUserId(user.id, orgId);
    if (!employee) {
      throw createError('No employee profile associated with your user account.', 404);
    }
    return employee;
  },

  isSupportStaff(user) {
    return HR_ADMIN_ROLES.includes(user.roleName) || (user.permissions && user.permissions.includes('helpdesk:manage'));
  },

  // ==========================================
  // 1. TICKET RETRIEVAL
  // ==========================================

  async getTickets(user, filters = {}) {
    const orgId = user.orgId || 'org-1';

    // If regular employee, automatically constrain to own tickets
    if (!this.isSupportStaff(user)) {
      const emp = await this.resolveEmployee(user);
      filters.employeeId = emp.id;
    }

    return await helpdeskRepository.findTickets(orgId, filters);
  },

  async getMyTickets(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    const emp = await this.resolveEmployee(user);
    filters.employeeId = emp.id;
    return await helpdeskRepository.findTickets(orgId, filters);
  },

  async getTicketById(user, id) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(id, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);

    // IDOR Protection: verify ticket ownership if regular employee
    if (!isStaff) {
      const emp = await this.resolveEmployee(user);
      if (ticket.employeeId !== emp.id) {
        throw createError('Access denied: You are not authorized to view this ticket.', 403);
      }
    }

    // Attach comments (internal comments hidden from non-staff)
    const comments = await helpdeskRepository.findCommentsByTicketId(ticket.id, orgId, isStaff);
    ticket.comments = comments;

    return ticket;
  },

  // ==========================================
  // 2. TICKET CREATION & COMMENTS
  // ==========================================

  async createTicket(user, data) {
    const orgId = user.orgId || 'org-1';
    const emp = await this.resolveEmployee(user);

    const ticket = await helpdeskRepository.createTicket({
      orgId,
      employeeId: emp.id,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'MEDIUM',
      attachmentUrl: data.attachmentUrl || '',
    });

    // Notify ticket creation
    try {
      await notificationService.notifyTicketCreated({
        orgId,
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        subject: ticket.subject,
        requesterUserId: user.id,
        assigneeUserId: ticket.assignedTo,
      });
    } catch (e) {
      // Non-blocking notification error
    }

    return ticket;
  },

  async addComment(user, ticketId, data) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(ticketId, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);

    // If employee, verify ticket ownership
    if (!isStaff) {
      const emp = await this.resolveEmployee(user);
      if (ticket.employeeId !== emp.id) {
        throw createError('Access denied: You cannot comment on this ticket.', 403);
      }
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw createError(`Cannot add a comment to a ${ticket.status} ticket.`, 400);
    }

    // Non-staff cannot post internal notes
    const isInternal = isStaff ? (data.isInternal === true) : false;

    const comment = await helpdeskRepository.addComment({
      ticketId: ticket.id,
      orgId,
      userId: user.id,
      comment: data.comment,
      isInternal,
    });

    // Notify recipient
    try {
      const recipientUserId = isStaff ? ticket.requester?.userId : ticket.assignedTo;
      if (recipientUserId && !isInternal) {
        await notificationService.notifyTicketStatusChanged({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          newStatus: `New Reply from ${user.firstName || 'Support'}`,
          recipientUserId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return comment;
  },

  // ==========================================
  // 3. EMPLOYEE CANCELLATION
  // ==========================================

  async cancelTicket(user, id) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(id, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);

    // Verify ownership if not staff
    if (!isStaff) {
      const emp = await this.resolveEmployee(user);
      if (ticket.employeeId !== emp.id) {
        throw createError('Access denied: You are not authorized to cancel this ticket.', 403);
      }
    }

    if (['RESOLVED', 'CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw createError(`Cannot cancel a ticket that is already ${ticket.status}.`, 400);
    }

    const cancelled = await helpdeskRepository.cancelTicket(ticket.id, orgId);

    try {
      if (ticket.assignedTo) {
        await notificationService.notifyTicketStatusChanged({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          newStatus: 'CANCELLED',
          recipientUserId: ticket.assignedTo,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return cancelled;
  },

  // ==========================================
  // 4. HR / ADMIN / SUPPORT ACTIONS
  // ==========================================

  async assignTicket(user, id, data) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(id, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw createError(`Cannot assign a ${ticket.status} ticket.`, 400);
    }

    const assigned = await helpdeskRepository.assignTicket(
      ticket.id,
      orgId,
      data.assignedTo,
      data.assignedTeam
    );

    try {
      if (data.assignedTo) {
        await notificationService.notifyTicketCreated({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          requesterUserId: null,
          assigneeUserId: data.assignedTo,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return assigned;
  },

  async updateStatus(user, id, status) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(id, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const upperStatus = status.toUpperCase();

    if (upperStatus === 'RESOLVED') {
      throw createError('Please use the resolve ticket endpoint with resolution notes.', 400);
    }
    if (upperStatus === 'CLOSED') {
      return this.closeTicket(user, id);
    }
    if (upperStatus === 'CANCELLED') {
      return this.cancelTicket(user, id);
    }

    const updated = await helpdeskRepository.updateStatus(ticket.id, orgId, upperStatus);

    try {
      if (ticket.requester?.userId) {
        await notificationService.notifyTicketStatusChanged({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          newStatus: upperStatus,
          recipientUserId: ticket.requester.userId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return updated;
  },

  async resolveTicket(user, id, resolution) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(id, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw createError(`Cannot resolve a ${ticket.status} ticket.`, 400);
    }

    const resolved = await helpdeskRepository.resolveTicket(ticket.id, orgId, resolution, user.id);

    try {
      if (ticket.requester?.userId) {
        await notificationService.notifyTicketStatusChanged({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          newStatus: 'RESOLVED',
          recipientUserId: ticket.requester.userId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return resolved;
  },

  async closeTicket(user, id) {
    const orgId = user.orgId || 'org-1';
    const ticket = await helpdeskRepository.findTicketById(id, orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const closed = await helpdeskRepository.closeTicket(ticket.id, orgId);

    try {
      if (ticket.requester?.userId) {
        await notificationService.notifyTicketStatusChanged({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          newStatus: 'CLOSED',
          recipientUserId: ticket.requester.userId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return closed;
  },

  // ==========================================
  // 5. STATS & METRICS
  // ==========================================

  async getStats(user) {
    const orgId = user.orgId || 'org-1';
    const isStaff = this.isSupportStaff(user);

    let employeeId = null;
    if (!isStaff) {
      const emp = await this.resolveEmployee(user);
      employeeId = emp.id;
    }

    return await helpdeskRepository.getTicketStats(orgId, employeeId);
  },
};
