import { workflowRepository } from '../repositories/workflowRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { performanceRepository } from '../repositories/performanceRepository.js';
import { leaveRepository } from '../repositories/leaveRepository.js';
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
   * Get pending approval queue for user
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
   * Get single workflow instance details
   */
  async getWorkflowById(currentUser, workflowId) {
    const wf = await workflowRepository.findById(workflowId);
    if (!wf || wf.orgId !== currentUser.orgId) {
      const err = new Error('Workflow instance not found.');
      err.statusCode = 404;
      throw err;
    }
    return wf;
  },

  /**
   * Execute an approval workflow action
   */
  async executeAction(currentUser, workflowId, actionData) {
    const wf = await this.getWorkflowById(currentUser, workflowId);
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    const action = actionData.action.toUpperCase();
    let nextStage = wf.currentStage;
    let toStatus = wf.currentStatus;

    // Stage validation
    if (wf.currentStage === 'MANAGER_REVIEW') {
      const isManager = emp && emp.id === wf.managerId;
      if (!isManager && !isHrAdmin) {
        const err = new Error('Forbidden: Only the reporting manager or HR can take action at the MANAGER_REVIEW stage.');
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE' || action === 'SUBMIT_REVIEW') {
        nextStage = 'HR_REVIEW';
        toStatus = 'UNDER_REVIEW';
      } else if (action === 'REJECT') {
        nextStage = 'REJECTED';
        toStatus = 'REJECTED';
      } else if (action === 'RETURN') {
        nextStage = 'EMPLOYEE_SUBMISSION';
        toStatus = 'RETURNED';
      }
    } else if (wf.currentStage === 'HR_REVIEW') {
      if (!isHrAdmin) {
        const err = new Error('Forbidden: Only HR or Admins can take action at the HR_REVIEW stage.');
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE') {
        nextStage = 'COMPLETED';
        toStatus = 'APPROVED';
      } else if (action === 'REJECT') {
        nextStage = 'REJECTED';
        toStatus = 'REJECTED';
      } else if (action === 'RETURN') {
        nextStage = 'MANAGER_REVIEW';
        toStatus = 'UNDER_REVIEW';
      }
    } else if (wf.currentStage === 'COMPLETED' || wf.currentStage === 'REJECTED') {
      const err = new Error(`Cannot perform action on a completed or rejected workflow.`);
      err.statusCode = 400;
      throw err;
    }

    // Update underlying domain entity if needed
    if (wf.entityType === 'PERFORMANCE_REVIEW') {
      try {
        await performanceRepository.updateStatus(wf.entityId, currentUser.orgId, toStatus, {
          approvalState: toStatus === 'APPROVED' ? 'APPROVED' : toStatus === 'REJECTED' ? 'REJECTED' : 'IN_REVIEW',
          actorUserId: currentUser.id,
          rejectionReason: actionData.comments || '',
          comments: actionData.comments || '',
        });
      } catch (e) {
        logger.warn('WorkflowService', `Failed to sync performance record: ${e.message}`);
      }
    } else if (wf.entityType === 'LEAVE_REQUEST' && action === 'APPROVE') {
      try {
        await leaveRepository.updateStatus(wf.entityId, currentUser.orgId, 'APPROVED', currentUser.id);
      } catch (e) {
        logger.warn('WorkflowService', `Failed to sync leave status: ${e.message}`);
      }
    } else if (wf.entityType === 'LEAVE_REQUEST' && action === 'REJECT') {
      try {
        await leaveRepository.updateStatus(wf.entityId, currentUser.orgId, 'REJECTED', currentUser.id, actionData.comments);
      } catch (e) {
        logger.warn('WorkflowService', `Failed to sync leave status: ${e.message}`);
      }
    }

    // Record action and transition workflow
    const updatedWf = await workflowRepository.recordAction(wf.id, {
      stage: wf.currentStage,
      actorUserId: currentUser.id,
      actorRole: currentUser.roleName || 'Reviewer',
      action,
      fromStatus: wf.currentStatus,
      toStatus,
      nextStage,
      hrUserId: isHrAdmin ? currentUser.id : null,
      comments: actionData.comments || '',
    });

    logger.info('WorkflowService', `Workflow ${wf.id} transitioned to stage ${nextStage} (status: ${toStatus})`);
    return updatedWf;
  },

  /**
   * Get immutable audit log for any entity
   */
  async getEntityAuditTrail(currentUser, entityType, entityId) {
    return workflowRepository.getAuditLog(entityType, entityId);
  },
};

export default workflowService;
