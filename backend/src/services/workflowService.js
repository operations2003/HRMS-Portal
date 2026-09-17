import { workflowRepository } from '../repositories/workflowRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { performanceRepository } from '../repositories/performanceRepository.js';
import { leaveService } from './leaveService.js';
import { employeeRequestRepository } from '../repositories/employeeRequestRepository.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';

export const workflowService = {
  /**
   * Helper to check if user has HR or Admin privileges
   */
  isHrOrAdmin(currentUser) {
    const role = (currentUser.roleName || '').toLowerCase();
    return ['admin', 'superadmin', 'hr', 'hrmanager'].includes(role);
  },

  /**
   * Helper to resolve current user's employee record
   */
  async resolveEmployee(currentUser) {
    return employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
  },

  /**
   * 1. Get pending approval queue for user
   */
  async getPendingQueue(currentUser, { entityType = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    return workflowRepository.findPendingQueue(currentUser.orgId, {
      managerEmployeeId: emp ? emp.id : null,
      isHrOrAdmin: isHrAdmin,
      entityType,
    });
  },

  /**
   * 2. Get single workflow instance details
   */
  async getWorkflowById(currentUser, workflowId) {
    if (!workflowId || typeof workflowId !== 'string') {
      const err = new Error('Workflow ID is required.');
      err.statusCode = 400;
      throw err;
    }

    const wf = await workflowRepository.findById(workflowId);
    if (!wf) {
      const err = new Error('Workflow instance not found.');
      err.statusCode = 404;
      throw err;
    }

    // Cross-organization validation
    const isSuperAdmin = (currentUser.roleName || '').toLowerCase() === 'superadmin';
    if (!isSuperAdmin && wf.orgId !== currentUser.orgId) {
      const err = new Error('Access denied: Workflow instance belongs to another organization.');
      err.statusCode = 403;
      throw err;
    }

    return wf;
  },

  /**
   * 3. Execute an approval workflow action
   */
  async executeAction(currentUser, workflowId, actionData = {}) {
    const wf = await this.getWorkflowById(currentUser, workflowId);
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    // =========================================================================
    // Security Enforcement 1: Prevent Double Approval & Action on Finalized State
    // =========================================================================
    if (
      ['COMPLETED', 'APPROVED', 'REJECTED'].includes(wf.currentStatus) ||
      ['COMPLETED', 'REJECTED'].includes(wf.currentStage)
    ) {
      const err = new Error(
        `Invalid status transition: Cannot perform action on an already finalized workflow (Current status: '${wf.currentStatus}', stage: '${wf.currentStage}').`
      );
      err.statusCode = 400;
      throw err;
    }

    // =========================================================================
    // Security Enforcement 2: Prevent Self-Approval
    // =========================================================================
    if (emp && emp.id === wf.requesterId) {
      const err = new Error('Self-approval violation: You cannot approve, return, or reject your own workflow request.');
      err.statusCode = 403;
      throw err;
    }

    // Resolve target requester employee for team scope verification
    const targetEmp = await employeeRepository.findById(wf.requesterId);

    // =========================================================================
    // Security Enforcement 3: Role & Team Scope Verification
    // =========================================================================
    const action = (actionData.action || '').toUpperCase();
    const reason = (actionData.comments || actionData.reason || actionData.rejectionReason || '').trim();

    let nextStage = wf.currentStage;
    let toStatus = wf.currentStatus;

    if (wf.currentStage === 'MANAGER_REVIEW') {
      const isDirectManager =
        emp &&
        ((wf.managerId && emp.id === wf.managerId) ||
          (targetEmp && targetEmp.managerId === emp.id) ||
          (targetEmp && targetEmp.deptId && emp.deptId && targetEmp.deptId === emp.deptId));

      if (!isDirectManager && !isHrAdmin) {
        const err = new Error(
          'Access denied: You are not authorized to take actions on requests outside your assigned team.'
        );
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE' || action === 'SUBMIT_REVIEW') {
        if (wf.entityType === 'PERFORMANCE_REVIEW') {
          nextStage = 'HR_REVIEW';
          toStatus = 'UNDER_REVIEW';
        } else {
          // Standard leave / employee request completes on manager approval unless HR stage explicitly required
          nextStage = 'COMPLETED';
          toStatus = 'APPROVED';
        }
      } else if (action === 'REJECT') {
        if (!reason || reason.length < 5) {
          const err = new Error('A rejection reason (at least 5 characters) is required to reject a workflow request.');
          err.statusCode = 400;
          throw err;
        }
        nextStage = 'REJECTED';
        toStatus = 'REJECTED';
      } else if (action === 'RETURN') {
        if (!reason || reason.length < 5) {
          const err = new Error('A reason (at least 5 characters) is required when returning a workflow request.');
          err.statusCode = 400;
          throw err;
        }
        nextStage = 'EMPLOYEE_SUBMISSION';
        toStatus = 'RETURNED';
      } else {
        const err = new Error(`Invalid workflow action '${action}' at stage '${wf.currentStage}'.`);
        err.statusCode = 400;
        throw err;
      }
    } else if (wf.currentStage === 'HR_REVIEW') {
      if (!isHrAdmin) {
        const err = new Error('Forbidden: Only HR or Administrators can take action at the HR_REVIEW stage.');
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE') {
        nextStage = 'COMPLETED';
        toStatus = 'APPROVED';
      } else if (action === 'REJECT') {
        if (!reason || reason.length < 5) {
          const err = new Error('A rejection reason (at least 5 characters) is required to reject a workflow request.');
          err.statusCode = 400;
          throw err;
        }
        nextStage = 'REJECTED';
        toStatus = 'REJECTED';
      } else if (action === 'RETURN') {
        if (!reason || reason.length < 5) {
          const err = new Error('A reason (at least 5 characters) is required when returning a workflow request.');
          err.statusCode = 400;
          throw err;
        }
        nextStage = 'MANAGER_REVIEW';
        toStatus = 'RETURNED';
      } else {
        const err = new Error(`Invalid workflow action '${action}' at stage '${wf.currentStage}'.`);
        err.statusCode = 400;
        throw err;
      }
    } else {
      const err = new Error(`Cannot perform action on workflow in current stage '${wf.currentStage}'.`);
      err.statusCode = 400;
      throw err;
    }

    // =========================================================================
    // 4. Synchronize Domain Entity
    // =========================================================================
    if (wf.entityType === 'PERFORMANCE_REVIEW') {
      try {
        const perfUpdates = {
          approvalState: toStatus === 'APPROVED' ? 'APPROVED' : toStatus === 'REJECTED' ? 'REJECTED' : 'IN_REVIEW',
          actorUserId: currentUser.id,
          rejectionReason: reason,
          comments: reason || actionData.feedback || '',
          feedback: actionData.feedback || '',
        };
        if (actionData.rating !== undefined) {
          perfUpdates.rating = parseFloat(actionData.rating);
        }
        if (actionData.score !== undefined) {
          perfUpdates.score = parseFloat(actionData.score);
        }

        await performanceRepository.updateStatus(wf.entityId, currentUser.orgId, toStatus, perfUpdates);
      } catch (e) {
        logger.warn('WorkflowService', `Failed to sync performance record ${wf.entityId}: ${e.message}`);
      }
    } else if (wf.entityType === 'LEAVE_REQUEST') {
      try {
        if (action === 'APPROVE') {
          await leaveService.approveLeave(currentUser, wf.entityId);
        } else if (action === 'REJECT') {
          await leaveService.rejectLeave(currentUser, wf.entityId, { rejectionReason: reason });
        }
      } catch (e) {
        logger.warn('WorkflowService', `Failed to sync leave request ${wf.entityId}: ${e.message}`);
      }
    } else if (wf.entityType === 'EMPLOYEE_REQUEST') {
      try {
        if (action === 'APPROVE') {
          await employeeRequestRepository.updateStatus(wf.entityId, currentUser.orgId, 'APPROVED', {
            approverUserId: currentUser.id,
            adminNotes: reason,
          });
        } else if (action === 'REJECT') {
          await employeeRequestRepository.updateStatus(wf.entityId, currentUser.orgId, 'REJECTED', {
            approverUserId: currentUser.id,
            rejectionReason: reason,
          });
        }
      } catch (e) {
        logger.warn('WorkflowService', `Failed to sync employee request ${wf.entityId}: ${e.message}`);
      }
    }

    // =========================================================================
    // 5. Record Action in Workflow Engine (Immutable Audit Log)
    // =========================================================================
    const updatedWf = await workflowRepository.recordAction(wf.id, {
      stage: wf.currentStage,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName || 'Reviewer',
      action,
      fromStatus: wf.currentStatus,
      toStatus,
      nextStage,
      hrUserId: isHrAdmin ? currentUser.id : null,
      comments: reason,
    });

    // =========================================================================
    // 6. Trigger Existing Notifications
    // =========================================================================
    try {
      if (targetEmp && targetEmp.userId) {
        let notifTitle = `Workflow Action: ${action} on ${wf.entityType.replace('_', ' ')}`;
        let notifMsg = `Your ${wf.entityType.replace('_', ' ').toLowerCase()} has transitioned to status '${toStatus}'.`;
        if (reason) notifMsg += ` Reason/Notes: "${reason}".`;

        await notificationService.createSystemNotification({
          orgId: currentUser.orgId,
          userId: targetEmp.userId,
          eventType: 'GENERAL_ALERT',
          title: notifTitle,
          message: notifMsg,
          entityType: wf.entityType,
          entityId: wf.entityId,
          actionUrl: wf.entityType === 'LEAVE_REQUEST' ? `/leaves/${wf.entityId}` : `/performance/${wf.entityId}`,
        });
      }
    } catch (notifErr) {
      logger.warn('WorkflowService', `Failed to send notification: ${notifErr.message}`);
    }

    logger.info(
      'WorkflowService',
      `Workflow ${wf.id} (${wf.entityType}) action '${action}' recorded by ${currentUser.email}: transitioned to stage '${nextStage}' (status: '${toStatus}')`
    );

    return updatedWf;
  },

  /**
   * 4. Get immutable audit log for any entity
   */
  async getEntityAuditTrail(currentUser, entityType, entityId) {
    if (!entityType || !entityId) {
      const err = new Error('Both entityType and entityId are required.');
      err.statusCode = 400;
      throw err;
    }
    return workflowRepository.getAuditLog(entityType, entityId);
  },
};

export default workflowService;
