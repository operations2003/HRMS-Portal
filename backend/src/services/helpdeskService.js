import { helpdeskRepository } from '../repositories/helpdeskRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { notificationService } from './notificationService.js';

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export const helpdeskService = {
  /**
   * Resolve employee record for logged-in user with email fallback
   */
  async resolveEmployee(user) {
    const orgId = user.orgId || 'org-1';
    let employee = await employeeRepository.findByUserId(user.id, orgId);
    if (!employee && user.email) {
      employee = await employeeRepository.findByEmail(user.email, orgId);
    }
    if (!employee) {
      throw createError('No employee profile associated with your user account.', 404);
    }
    return employee;
  },

  /**
   * Helper: Normalized check whether user has HR / Admin / Support privileges
   */
  isSupportStaff(user) {
    const normRole = (user?.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const isStaffRole = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole);
    const hasManagePerm = Array.isArray(user?.permissions) && user.permissions.includes('helpdesk:manage');
    return isStaffRole || hasManagePerm;
  },

  // ==========================================
  // 1. TICKET RETRIEVAL
  // ==========================================

  async getTickets(user, filters = {}) {
    const orgId = user.orgId || 'org-1';

    // If regular employee, automatically constrain to own or assigned tickets
    if (!this.isSupportStaff(user)) {
      let emp = null;
      try {
        emp = await this.resolveEmployee(user);
      } catch {
        // User without employee profile
      }
      if (emp) {
        filters.myTicketsFor = { employeeId: emp.id, userId: user.id };
      } else {
        filters.assignedTo = user.id;
      }
    }

    return await helpdeskRepository.findTickets(orgId, filters);
  },

  async getMyTickets(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    let emp = null;
    try {
      emp = await this.resolveEmployee(user);
    } catch {
      // User without employee profile
    }
    if (emp) {
      filters.myTicketsFor = { employeeId: emp.id, userId: user.id };
    } else {
      filters.assignedTo = user.id;
    }
    return await helpdeskRepository.findTickets(orgId, filters);
  },

  /**
   * Helper: Resolve assigned user ID based on specified role or user ID
   * Supports: 'MANAGER' (reporting manager), 'HR' (HR department), 'ADMIN' (IT/System admin)
   */
  async resolveAssignee(orgId, requesterEmployee, targetRoleOrUserId, category = '') {
    let target = (targetRoleOrUserId || '').toString().trim();
    if (!target) {
      if (category === 'IT_SUPPORT') target = 'ADMIN';
      else if (category === 'LEAVE_ATTENDANCE' && requesterEmployee?.managerId) target = 'MANAGER';
      else target = 'HR';
    }

    let upperTarget = target.toUpperCase();

    // 1. Assign to Reporting Manager
    if (upperTarget === 'MANAGER') {
      if (requesterEmployee?.managerId) {
        try {
          const mgrEmp = await employeeRepository.findById(requesterEmployee.managerId, orgId);
          if (mgrEmp?.userId) {
            return { assigneeUserId: mgrEmp.userId, assignedTeam: 'MANAGEMENT' };
          }
          if (mgrEmp?.email) {
            const mgrUser = await userRepository.findByEmail(mgrEmp.email);
            if (mgrUser?.id) {
              return { assigneeUserId: mgrUser.id, assignedTeam: 'MANAGEMENT' };
            }
          }
        } catch (e) {
          console.warn('[Helpdesk] Could not resolve manager employee:', e.message);
        }
      }
      // If employee has no manager assigned, fallback to HR
      upperTarget = 'HR';
    }

    // 2. Assign to HR
    if (upperTarget === 'HR') {
      if (requesterEmployee?.hrId) {
        try {
          const hrEmp = await employeeRepository.findById(requesterEmployee.hrId, orgId);
          if (hrEmp?.userId) {
            return { assigneeUserId: hrEmp.userId, assignedTeam: 'HR' };
          }
          if (hrEmp?.email) {
            const hrUser = await userRepository.findByEmail(hrEmp.email);
            if (hrUser?.id) {
              return { assigneeUserId: hrUser.id, assignedTeam: 'HR' };
            }
          }
        } catch (e) {
          console.warn('[Helpdesk] Could not resolve hr employee:', e.message);
        }
      }

      // Find an active HR user in the organization
      try {
        const allUsers = await userRepository.findAll();
        const hrUser = allUsers.find(
          (u) =>
            (u.orgId === orgId || u.orgId === 'org-1') &&
            (u.roleName?.toLowerCase().includes('hr') || u.roleId?.toLowerCase().includes('hr')) &&
            u.status === 'Active'
        );
        if (hrUser?.id) {
          return { assigneeUserId: hrUser.id, assignedTeam: 'HR' };
        }
      } catch (e) {
        console.warn('[Helpdesk] Could not find HR user:', e.message);
      }
      // Fallback to Admin
      upperTarget = 'ADMIN';
    }

    // 3. Assign to Admin / IT Support
    if (upperTarget === 'ADMIN' || upperTarget === 'IT_SUPPORT') {
      try {
        const allUsers = await userRepository.findAll();
        const adminUser = allUsers.find(
          (u) =>
            (u.orgId === orgId || u.orgId === 'org-1') &&
            (u.roleName?.toLowerCase().includes('admin') || u.roleId?.toLowerCase().includes('admin')) &&
            u.status === 'Active'
        );
        if (adminUser?.id) {
          return { assigneeUserId: adminUser.id, assignedTeam: 'IT_SUPPORT' };
        }
      } catch (e) {
        console.warn('[Helpdesk] Could not find Admin user:', e.message);
      }
      return { assigneeUserId: 'user-superadmin-shubham', assignedTeam: 'IT_SUPPORT' };
    }

    // 4. Specific User ID provided
    try {
      const userRecord = await userRepository.findById(target);
      if (userRecord && (userRecord.orgId === orgId || userRecord.orgId === 'org-1')) {
        return { assigneeUserId: userRecord.id, assignedTeam: 'SUPPORT' };
      }
    } catch (e) {
      console.warn('[Helpdesk] Could not find user by ID:', e.message);
    }

    return { assigneeUserId: null, assignedTeam: '' };
  },

  async getTicketById(user, id) {
    const orgId = user.orgId || 'org-1';
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(id.trim(), orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);

    // IDOR Protection: verify ticket access (staff, requester, or assignee)
    if (!isStaff) {
      let empId = null;
      try {
        const emp = await this.resolveEmployee(user);
        empId = emp?.id || null;
      } catch (e) {
        // User may not have an employee record, but could be assigned by user.id
      }
      const isRequester = empId && ticket.employeeId === empId;
      const isAssignee =
        (ticket.assignedTo && ticket.assignedTo === user.id) ||
        (ticket.assignee && ticket.assignee.id === user.id);

      if (!isRequester && !isAssignee) {
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
    let employeeId = null;
    let requesterEmp = null;

    if (this.isSupportStaff(user) && data.employeeId) {
      const targetEmp = await employeeRepository.findById(data.employeeId, orgId);
      if (!targetEmp || (targetEmp.orgId !== orgId && targetEmp.orgId !== 'org-1')) {
        throw createError('Valid employee is required. Specified employee does not exist in your organization.', 400);
      }
      employeeId = targetEmp.id;
      requesterEmp = targetEmp;
    } else {
      requesterEmp = await this.resolveEmployee(user);
      employeeId = requesterEmp.id;
    }

    // Resolve assignee (Manager, HR, or Admin)
    const targetAssignee = data.assignedToRole || data.assigneeRole || data.assignTo || data.assignedTo;
    const { assigneeUserId, assignedTeam } = await this.resolveAssignee(
      orgId,
      requesterEmp,
      targetAssignee,
      data.category
    );

    const ticket = await helpdeskRepository.createTicket({
      orgId,
      employeeId,
      category: data.category,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'MEDIUM',
      attachmentUrl: data.attachmentUrl || '',
      assignedTo: assigneeUserId,
      assignedTeam,
    });

    // Notify ticket creation and assignment
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
    if (!ticketId || typeof ticketId !== 'string' || !ticketId.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(ticketId.trim(), orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);

    // IDOR Protection: verify ticket access (staff, requester, or assignee)
    if (!isStaff) {
      let empId = null;
      try {
        const emp = await this.resolveEmployee(user);
        empId = emp?.id || null;
      } catch (e) {
        // User may not have an employee record, but could be assigned by user.id
      }
      const isRequester = empId && ticket.employeeId === empId;
      const isAssignee =
        (ticket.assignedTo && ticket.assignedTo === user.id) ||
        (ticket.assignee && ticket.assignee.id === user.id);

      if (!isRequester && !isAssignee) {
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
      const isRequester = ticket.requester?.userId === user.id;
      const recipientUserId = isRequester ? ticket.assignedTo : ticket.requester?.userId;
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
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(id.trim(), orgId);
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
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(id.trim(), orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw createError(`Cannot assign a ${ticket.status} ticket.`, 400);
    }

    if (data.assignedTo) {
      const assigneeUser = await userRepository.findById(data.assignedTo);
      if (!assigneeUser || (assigneeUser.orgId !== orgId && assigneeUser.orgId !== 'org-1')) {
        throw createError('Invalid assignee: User does not exist in this organization.', 400);
      }
    }

    const assigned = await helpdeskRepository.assignTicket(
      ticket.id,
      orgId,
      data.assignedTo,
      data.assignedTeam
    );

    try {
      if (data.assignedTo) {
        await notificationService.notifyTicketAssigned({
          orgId,
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          assigneeUserId: data.assignedTo,
          assignedByName: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return assigned;
  },

  async updateStatus(user, id, status) {
    const orgId = user.orgId || 'org-1';
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(id.trim(), orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);
    const isAssignee =
      (ticket.assignedTo && ticket.assignedTo === user.id) ||
      (ticket.assignee && ticket.assignee.id === user.id);

    if (!isStaff && !isAssignee) {
      throw createError('Access denied: You are not authorized to update this ticket.', 403);
    }

    if (ticket.status === 'CLOSED') {
      throw createError('Cannot modify a CLOSED ticket.', 400);
    }
    if (ticket.status === 'CANCELLED') {
      throw createError('Cannot modify a CANCELLED ticket.', 400);
    }

    const upperStatus = (status || '').toUpperCase();
    if (!['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'].includes(upperStatus)) {
      throw createError('Invalid ticket status. Must be one of: OPEN, IN_PROGRESS, RESOLVED, CLOSED, CANCELLED.', 400);
    }

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
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(id.trim(), orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    const isStaff = this.isSupportStaff(user);
    const isAssignee =
      (ticket.assignedTo && ticket.assignedTo === user.id) ||
      (ticket.assignee && ticket.assignee.id === user.id);

    if (!isStaff && !isAssignee) {
      throw createError('Access denied: You are not authorized to resolve this ticket.', 403);
    }

    if (['CLOSED', 'CANCELLED'].includes(ticket.status)) {
      throw createError(`Cannot resolve a ${ticket.status} ticket.`, 400);
    }

    if (!resolution || typeof resolution !== 'string' || !resolution.trim()) {
      throw createError('Resolution description is required to resolve a ticket.', 400);
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
    if (!id || typeof id !== 'string' || !id.trim()) {
      throw createError('Valid ticket ID is required.', 400);
    }

    const ticket = await helpdeskRepository.findTicketById(id.trim(), orgId);
    if (!ticket) {
      throw createError('Helpdesk ticket not found.', 404);
    }

    if (ticket.status === 'CLOSED') {
      throw createError('Ticket is already closed.', 400);
    }
    if (ticket.status === 'CANCELLED') {
      throw createError('Cannot close a CANCELLED ticket.', 400);
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
    let userId = null;
    if (!isStaff) {
      try {
        const emp = await this.resolveEmployee(user);
        employeeId = emp.id;
        userId = user.id;
      } catch {
        userId = user.id;
      }
    }

    return await helpdeskRepository.getTicketStats(orgId, employeeId, userId);
  },
};

