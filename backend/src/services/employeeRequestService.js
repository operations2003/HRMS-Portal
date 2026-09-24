import { employeeRequestRepository } from '../repositories/employeeRequestRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { notificationService } from './notificationService.js';

const createError = (message, statusCode = 400) => {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const HR_ADMIN_ROLES = ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'];

export const employeeRequestService = {
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

  isStaff(user) {
    if (!user) return false;
    const roleStr =
      user.roleName ||
      (typeof user.role === 'string' ? user.role : user.role?.name) ||
      user.roleId ||
      '';
    const normRole = roleStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isStaffRole = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(normRole);
    const hasManagePerm =
      Array.isArray(user.permissions) &&
      (user.permissions.includes('request:manage') || user.permissions.includes('helpdesk:manage'));
    return Boolean(isStaffRole || hasManagePerm);
  },

  isSupportStaff(user) {
    return this.isStaff(user);
  },

  // ==========================================
  // 1. REQUEST RETRIEVAL
  // ==========================================

  async getRequests(user, filters = {}) {
    const orgId = user.orgId || 'org-1';

    // If regular employee, automatically constrain to own or assigned requests
    if (!this.isStaff(user)) {
      let emp = null;
      try {
        emp = await this.resolveEmployee(user);
      } catch {
        // User without employee profile
      }
      if (emp) {
        filters.myRequestsFor = { employeeId: emp.id, userId: user.id };
      } else {
        filters.assignedTo = user.id;
      }
    }

    return await employeeRequestRepository.findRequests(orgId, filters);
  },

  async getMyRequests(user, filters = {}) {
    const orgId = user.orgId || 'org-1';
    let emp = null;
    try {
      emp = await this.resolveEmployee(user);
    } catch {
      // User without employee profile
    }
    if (emp) {
      filters.myRequestsFor = { employeeId: emp.id, userId: user.id };
    } else {
      filters.assignedTo = user.id;
    }
    return await employeeRequestRepository.findRequests(orgId, filters);
  },

  async getRequestById(user, id) {
    const orgId = user.orgId || 'org-1';
    const request = await employeeRequestRepository.findRequestById(id, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    const staffMember = this.isStaff(user);

    // IDOR Protection: verify request ownership or assignment if regular employee
    if (!staffMember) {
      let emp = null;
      try {
        emp = await this.resolveEmployee(user);
      } catch {
        // User may only have user account
      }
      const isOwner = emp && request.employeeId === emp.id;
      const isAssignee = request.assignedTo === user.id || request.assignee?.id === user.id;
      if (!isOwner && !isAssignee) {
        throw createError('Access denied: You are not authorized to view this request.', 403);
      }
    }

    // Attach updates thread (internal updates hidden from non-staff)
    const updates = await employeeRequestRepository.findUpdatesByRequestId(request.id, orgId, staffMember);
    request.updates = updates;

    return request;
  },

  // ==========================================
  // 2. REQUEST CREATION & UPDATES
  // ==========================================

  async createRequest(user, data) {
    const orgId = user.orgId || 'org-1';
    const emp = await this.resolveEmployee(user);

    const request = await employeeRequestRepository.createRequest({
      orgId,
      employeeId: emp.id,
      requestType: data.requestType,
      subject: data.subject,
      description: data.description,
      priority: data.priority || 'MEDIUM',
      attachmentUrl: data.attachmentUrl || '',
      documentVaultId: data.documentVaultId || null,
    });

    // Notify request creation
    try {
      await notificationService.notifyRequestCreated({
        orgId,
        requestId: request.id,
        requestNumber: request.requestNumber,
        subject: request.subject,
        requesterUserId: user.id,
        assigneeUserId: request.assignedTo,
      });
    } catch {
      // Non-blocking
    }

    // Auto-create approval workflow instance
    try {
      await workflowRepository.createWorkflowInstance(
        {
          orgId,
          entityType: 'EMPLOYEE_REQUEST',
          entityId: request.id,
          workflowType: 'EMPLOYEE_MANAGER_HR',
          currentStage: 'MANAGER_REVIEW',
          currentStatus: 'SUBMITTED',
          requesterId: emp.id,
          managerId: emp.managerId || null,
          hrUserId: null,
        },
        {
          actorUserId: user.id,
          actorRole: 'EMPLOYEE',
          action: 'SUBMIT',
          fromStatus: 'PENDING',
          toStatus: 'SUBMITTED',
          comments: request.subject || 'Employee request submission',
        }
      );
    } catch {
      // Non-blocking
    }

    return request;
  },

  async addUpdate(user, requestId, data) {
    const orgId = user.orgId || 'org-1';
    const request = await employeeRequestRepository.findRequestById(requestId, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    const staffMember = this.isStaff(user);

    // If employee, verify request ownership or assignment
    if (!staffMember) {
      let emp = null;
      try {
        emp = await this.resolveEmployee(user);
      } catch {
        // ignore
      }
      const isOwner = emp && request.employeeId === emp.id;
      const isAssignee = request.assignedTo === user.id || request.assignee?.id === user.id;
      if (!isOwner && !isAssignee) {
        throw createError('Access denied: You cannot add updates to this request.', 403);
      }
    }

    if (['RESOLVED', 'REJECTED', 'CANCELLED'].includes(request.status)) {
      throw createError(`Cannot add an update to a ${request.status} request.`, 400);
    }

    // Non-staff cannot post internal notes
    const isInternal = staffMember ? (data.isInternal === true) : false;

    return await employeeRequestRepository.addUpdate({
      requestId: request.id,
      orgId,
      userId: user.id,
      message: data.message,
      isInternal,
    });
  },

  // ==========================================
  // 3. EMPLOYEE CANCELLATION
  // ==========================================

  async cancelRequest(user, id) {
    const orgId = user.orgId || 'org-1';
    const request = await employeeRequestRepository.findRequestById(id, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    const staffMember = this.isStaff(user);

    // Verify ownership if not staff
    if (!staffMember) {
      const emp = await this.resolveEmployee(user);
      if (request.employeeId !== emp.id) {
        throw createError('Access denied: You are not authorized to cancel this request.', 403);
      }
    }

    if (['RESOLVED', 'REJECTED', 'CANCELLED'].includes(request.status)) {
      throw createError(`Cannot cancel a request that is already ${request.status}.`, 400);
    }

    const cancelled = await employeeRequestRepository.cancelRequest(request.id, orgId);

    try {
      const recipientUserId = request.assignedTo || request.requester?.userId;
      if (recipientUserId) {
        await notificationService.notifyRequestStatusChanged({
          orgId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          subject: request.subject,
          newStatus: 'CANCELLED',
          recipientUserId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return cancelled;
  },

  // ==========================================
  // 4. HR / ADMIN ACTIONS
  // ==========================================

  async assignRequest(user, id, data) {
    const orgId = user.orgId || 'org-1';
    const request = await employeeRequestRepository.findRequestById(id, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    if (['RESOLVED', 'REJECTED', 'CANCELLED'].includes(request.status)) {
      throw createError(`Cannot assign a ${request.status} request.`, 400);
    }

    const assigned = await employeeRequestRepository.assignRequest(
      request.id,
      orgId,
      data.assignedTo,
      data.assignedTeam
    );

    try {
      if (data.assignedTo && data.assignedTo !== user.id) {
        await notificationService.notifyRequestCreated({
          orgId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          subject: request.subject,
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
    const request = await employeeRequestRepository.findRequestById(id, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    const upperStatus = status.toUpperCase();

    if (upperStatus === 'RESOLVED') {
      throw createError('Please use the resolve request endpoint with response notes.', 400);
    }
    if (upperStatus === 'REJECTED') {
      throw createError('Please use the reject request endpoint with rejection reason.', 400);
    }
    if (upperStatus === 'CANCELLED') {
      return this.cancelRequest(user, id);
    }

    const updated = await employeeRequestRepository.updateStatus(request.id, orgId, upperStatus);

    try {
      if (request.requester?.userId) {
        await notificationService.notifyRequestStatusChanged({
          orgId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          subject: request.subject,
          newStatus: upperStatus,
          recipientUserId: request.requester.userId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    return updated;
  },

  async resolveRequest(user, id, data) {
    const userRole = (user.roleName || user.role || '').toLowerCase();
    const isApprover =
      HR_ADMIN_ROLES.some((r) => userRole.includes(r.toLowerCase())) ||
      ['manager', 'lead', 'teamlead', 'supervisor'].some((r) => userRole.includes(r)) ||
      (user.permissions && user.permissions.includes('request:manage'));

    if (!isApprover) {
      throw createError('Access denied: Only Admin, HR, and Manager roles have authority to resolve or approve requests.', 403);
    }

    const orgId = user.orgId || 'org-1';
    const request = await employeeRequestRepository.findRequestById(id, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    if (['RESOLVED', 'REJECTED', 'CANCELLED'].includes(request.status)) {
      throw createError(`Cannot resolve a ${request.status} request.`, 400);
    }

    const resolved = await employeeRequestRepository.resolveRequest(
      request.id,
      orgId,
      data.responseNotes,
      user.id,
      data.documentVaultId
    );

    try {
      if (request.requester?.userId) {
        await notificationService.notifyRequestStatusChanged({
          orgId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          subject: request.subject,
          newStatus: 'RESOLVED',
          recipientUserId: request.requester.userId,
        });
      }
    } catch {
      // Non-blocking
    }

    // Sync approval_workflows if instance exists
    try {
      const wf = await workflowRepository.findByEntity('EMPLOYEE_REQUEST', request.id);
      if (wf && wf.currentStatus !== 'APPROVED') {
        await workflowRepository.recordAction(wf.id, {
          stage: wf.currentStage,
          actorUserId: user.id,
          actorRole: user.roleName || 'ADMIN',
          action: 'APPROVE',
          fromStatus: wf.currentStatus,
          toStatus: 'APPROVED',
          nextStage: 'COMPLETED',
          comments: data.responseNotes || 'Resolved by administrator',
        });
      }
    } catch {
      // Non-blocking sync
    }

    return resolved;
  },

  async rejectRequest(user, id, data) {
    const userRole = (user.roleName || user.role || '').toLowerCase();
    const isApprover =
      HR_ADMIN_ROLES.some((r) => userRole.includes(r.toLowerCase())) ||
      ['manager', 'lead', 'teamlead', 'supervisor'].some((r) => userRole.includes(r)) ||
      (user.permissions && user.permissions.includes('request:manage'));

    if (!isApprover) {
      throw createError('Access denied: Only Admin, HR, and Manager roles have authority to reject requests.', 403);
    }

    const orgId = user.orgId || 'org-1';
    const request = await employeeRequestRepository.findRequestById(id, orgId);
    if (!request) {
      throw createError('Employee request not found.', 404);
    }

    if (['RESOLVED', 'REJECTED', 'CANCELLED'].includes(request.status)) {
      throw createError(`Cannot reject a ${request.status} request.`, 400);
    }

    const rejected = await employeeRequestRepository.rejectRequest(
      request.id,
      orgId,
      data.rejectionReason
    );

    try {
      if (request.requester?.userId) {
        await notificationService.notifyRequestStatusChanged({
          orgId,
          requestId: request.id,
          requestNumber: request.requestNumber,
          subject: request.subject,
          newStatus: 'REJECTED',
          recipientUserId: request.requester.userId,
        });
      }
    } catch (e) {
      // Non-blocking
    }

    // Sync approval_workflows if instance exists
    try {
      const wf = await workflowRepository.findByEntity('EMPLOYEE_REQUEST', request.id);
      if (wf && wf.currentStatus !== 'REJECTED') {
        await workflowRepository.recordAction(wf.id, {
          stage: wf.currentStage,
          actorUserId: user.id,
          actorRole: user.roleName || 'ADMIN',
          action: 'REJECT',
          fromStatus: wf.currentStatus,
          toStatus: 'REJECTED',
          nextStage: 'REJECTED',
          comments: data.rejectionReason || 'Rejected by administrator',
        });
      }
    } catch {
      // Non-blocking sync
    }

    return rejected;
  },

  // ==========================================
  // 5. STATS & METRICS
  // ==========================================

  async getStats(user) {
    const orgId = user.orgId || 'org-1';
    const staffMember = this.isStaff(user);

    let employeeId = null;
    let userId = null;
    if (!staffMember) {
      try {
        const emp = await this.resolveEmployee(user);
        employeeId = emp.id;
        userId = user.id;
      } catch {
        userId = user.id;
      }
    }

    return await employeeRequestRepository.getRequestStats(orgId, employeeId, userId);
  },
};
