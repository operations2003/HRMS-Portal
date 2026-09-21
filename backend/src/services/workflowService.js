import { workflowRepository } from '../repositories/workflowRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { performanceRepository } from '../repositories/performanceRepository.js';
import { leaveService } from './leaveService.js';
import { employeeRequestRepository } from '../repositories/employeeRequestRepository.js';
import { exitRepository } from '../repositories/exitRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { notificationService } from './notificationService.js';
import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const workflowService = {
  /**
   * Helper to check if user has HR or Admin privileges
   */
  isHrOrAdmin(currentUser) {
    const role = (currentUser.roleName || '').toLowerCase();
    return ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(role);
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

    let wf = await workflowRepository.findById(workflowId);
    if (!wf) {
      // 1. Check if workflowId was passed as an entity ID
      wf =
        (await workflowRepository.findByEntity('EMPLOYEE_REQUEST', workflowId)) ||
        (await workflowRepository.findByEntity('REQUEST', workflowId)) ||
        (await workflowRepository.findByEntity('LEAVE_REQUEST', workflowId)) ||
        (await workflowRepository.findByEntity('PERFORMANCE', workflowId)) ||
        (await workflowRepository.findByEntity('PERFORMANCE_REVIEW', workflowId)) ||
        (await workflowRepository.findByEntity('EXIT_REQUEST', workflowId));
    }

    // 2. If still not found and workflowId corresponds to an employee request, auto-provision workflow
    if (!wf) {
      const empReq = await employeeRequestRepository.findRequestById(workflowId, currentUser.orgId);
      if (empReq) {
        const reqEmp = await employeeRepository.findById(empReq.employeeId);
        wf = await workflowRepository.createWorkflowInstance(
          {
            orgId: currentUser.orgId,
            entityType: 'EMPLOYEE_REQUEST',
            entityId: empReq.id,
            workflowType: 'EMPLOYEE_MANAGER_HR',
            currentStage: 'MANAGER_REVIEW',
            currentStatus: empReq.status === 'PENDING' ? 'SUBMITTED' : empReq.status,
            requesterId: empReq.employeeId,
            managerId: reqEmp?.managerId || null,
            hrUserId: null,
          },
          {
            actorUserId: reqEmp?.userId || currentUser.id,
            actorRole: 'EMPLOYEE',
            action: 'SUBMIT',
            fromStatus: 'PENDING',
            toStatus: 'SUBMITTED',
            comments: empReq.subject || 'Employee request submission',
          }
        );
      }
    }

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
    // Security Enforcement 1: Prevent Action on Finalized State
    // =========================================================================
    const isFinalized =
      wf.currentStage === 'COMPLETED' ||
      wf.currentStage === 'REJECTED' ||
      wf.currentStatus === 'COMPLETED' ||
      wf.currentStatus === 'REJECTED' ||
      (wf.entityType !== 'EXIT_REQUEST' && wf.currentStatus === 'APPROVED');

    if (isFinalized) {
      const err = new Error(
        `Invalid status transition: Cannot perform action on an already finalized workflow (Current status: '${wf.currentStatus}', stage: '${wf.currentStage}').`
      );
      err.statusCode = 400;
      throw err;
    }

    const action = (actionData.action || '').toUpperCase();
    const reason = (actionData.comments || actionData.reason || actionData.rejectionReason || '').trim();

    // =========================================================================
    // Security Enforcement 2: Prevent Self-Approval
    // =========================================================================
    if (
      emp &&
      emp.id === wf.requesterId &&
      ['APPROVE', 'REJECT', 'RETURN', 'SUBMIT_REVIEW', 'REVIEW', 'CLEAR', 'DEPROVISION'].includes(action)
    ) {
      const err = new Error('Self-approval violation: You cannot approve, review, or clear your own workflow request.');
      err.statusCode = 403;
      throw err;
    }

    // Resolve target requester employee for team scope verification
    const targetEmp = await employeeRepository.findById(wf.requesterId);

    // =========================================================================
    // Security Enforcement 3: Role & Team Scope Verification
    // =========================================================================
    const userRole = (currentUser.roleName || currentUser.role || '').toLowerCase();
    const isManagerRole = ['manager', 'lead', 'teamlead', 'supervisor'].some((r) => userRole.includes(r));

    // Approval, rejection, and return are strictly restricted to Admin, HR, and Manager
    if (['APPROVE', 'REJECT', 'RETURN'].includes(action)) {
      if (!isHrAdmin && !isManagerRole) {
        const err = new Error(
          'Access denied: Only Admin, HR, and Manager roles have the authority to approve, reject, or return requests.'
        );
        err.statusCode = 403;
        throw err;
      }
    }

    let nextStage = wf.currentStage;
    let toStatus = wf.currentStatus;

    if (wf.currentStage === 'EMPLOYEE_SUBMISSION') {
      const isRequester = emp && emp.id === wf.requesterId;
      if (!isRequester && !isHrAdmin) {
        const err = new Error('Access denied: Only the requester can submit or resubmit this workflow.');
        err.statusCode = 403;
        throw err;
      }

      if (action === 'SUBMIT' || action === 'RESUBMIT' || action === 'SUBMIT_REVIEW') {
        nextStage = 'MANAGER_REVIEW';
        toStatus = 'SUBMITTED';
      } else {
        const err = new Error(`Invalid workflow action '${action}' at stage '${wf.currentStage}'. Expected SUBMIT or RESUBMIT.`);
        err.statusCode = 400;
        throw err;
      }
    } else if (wf.currentStage === 'MANAGER_REVIEW') {
      const isDirectManager =
        emp &&
        ((wf.managerId && emp.id === wf.managerId) ||
          (targetEmp && targetEmp.managerId && targetEmp.managerId === emp.id) ||
          (!wf.managerId && (!targetEmp || !targetEmp.managerId) && isManagerRole && targetEmp && targetEmp.deptId && emp.deptId && targetEmp.deptId === emp.deptId));

      if (!isDirectManager && !isHrAdmin) {
        const err = new Error(
          'Access denied: You are not authorized to take actions on requests outside your assigned team.'
        );
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE' || action === 'SUBMIT_REVIEW' || action === 'REVIEW') {
        if (wf.entityType === 'PERFORMANCE_REVIEW' || wf.entityType === 'EXIT_REQUEST') {
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
        if (wf.entityType === 'EXIT_REQUEST') {
          nextStage = 'CLEARANCE_IN_PROGRESS';
          toStatus = 'APPROVED';
        } else {
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
        nextStage = 'MANAGER_REVIEW';
        toStatus = 'RETURNED';
      } else {
        const err = new Error(`Invalid workflow action '${action}' at stage '${wf.currentStage}'.`);
        err.statusCode = 400;
        throw err;
      }
    } else if (wf.currentStage === 'CLEARANCE_IN_PROGRESS') {
      if (!isHrAdmin) {
        const err = new Error('Forbidden: Only HR or Administrators can execute actions at CLEARANCE_IN_PROGRESS stage.');
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE' || action === 'REVIEW') {
        nextStage = 'FNF_PENDING';
        toStatus = 'APPROVED';
      } else if (action === 'DEPROVISION') {
        nextStage = 'CLEARANCE_IN_PROGRESS';
        toStatus = 'APPROVED';
      } else if (action === 'REJECT') {
        if (!reason || reason.length < 5) {
          const err = new Error('A rejection reason (at least 5 characters) is required to reject a workflow request.');
          err.statusCode = 400;
          throw err;
        }
        nextStage = 'REJECTED';
        toStatus = 'REJECTED';
      } else {
        const err = new Error(`Invalid workflow action '${action}' at stage '${wf.currentStage}'.`);
        err.statusCode = 400;
        throw err;
      }
    } else if (wf.currentStage === 'FNF_PENDING') {
      if (!isHrAdmin) {
        const err = new Error('Forbidden: Only HR or Administrators can execute actions at FNF_PENDING stage.');
        err.statusCode = 403;
        throw err;
      }

      if (action === 'APPROVE') {
        nextStage = 'COMPLETED';
        toStatus = 'COMPLETED';
      } else if (action === 'DEPROVISION') {
        nextStage = 'FNF_PENDING';
        toStatus = 'APPROVED';
      } else if (action === 'REJECT') {
        if (!reason || reason.length < 5) {
          const err = new Error('A rejection reason (at least 5 characters) is required to reject a workflow request.');
          err.statusCode = 400;
          throw err;
        }
        nextStage = 'REJECTED';
        toStatus = 'REJECTED';
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
      const perfUpdates = {
        approvalState: toStatus === 'APPROVED' ? 'APPROVED' : toStatus === 'REJECTED' ? 'REJECTED' : toStatus === 'RETURNED' ? 'RETURNED' : 'IN_REVIEW',
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
    } else if (wf.entityType === 'LEAVE_REQUEST') {
      if (action === 'APPROVE') {
        await leaveService.approveLeave(currentUser, wf.entityId, { skipWorkflowSync: true });
      } else if (action === 'REJECT') {
        await leaveService.rejectLeave(currentUser, wf.entityId, { rejectionReason: reason, skipWorkflowSync: true });
      }
    } else if (wf.entityType === 'EMPLOYEE_REQUEST' || wf.entityType === 'REQUEST') {
      if (action === 'APPROVE') {
        await employeeRequestRepository.resolveRequest(
          wf.entityId,
          currentUser.orgId,
          reason || 'Approved by administrator',
          currentUser.id
        );
      } else if (action === 'REJECT') {
        await employeeRequestRepository.rejectRequest(
          wf.entityId,
          currentUser.orgId,
          reason || 'Rejected by administrator'
        );
      }
    } else if (wf.entityType === 'EXIT_REQUEST') {
      if (action === 'APPROVE' || action === 'REVIEW' || action === 'SUBMIT_REVIEW') {
        if (wf.currentStage === 'MANAGER_REVIEW') {
          await exitRepository.update(wf.entityId, {
            status: 'UNDER_REVIEW',
            currentStage: 'HR_REVIEW',
            managerFeedback: reason || actionData.feedback || 'Manager reviewed resignation.',
            managerRating: actionData.rating ? parseFloat(actionData.rating) : null,
            managerReviewedAt: new Date().toISOString(),
          });
        } else if (wf.currentStage === 'HR_REVIEW') {
          const exitRec = await exitRepository.findById(wf.entityId);
          const approvedLwd =
            actionData.approvedLastWorkingDay ||
            (exitRec ? exitRec.requestedLastWorkingDay : new Date().toISOString().split('T')[0]);

          await exitRepository.update(wf.entityId, {
            status: 'APPROVED',
            currentStage: 'CLEARANCE_IN_PROGRESS',
            approvedBy: currentUser.id,
            approvedLastWorkingDay: approvedLwd,
            hrComments: reason || 'HR approved resignation and initialized clearance tasks.',
            hrReviewedAt: new Date().toISOString(),
          });

          // Transition employee to Notice Period
          await employeeRepository.update(wf.requesterId, { status: 'Notice Period' });

          // Initialize employee_offboardings tracking record
          await exitRepository.upsertOffboarding({
            orgId: currentUser.orgId,
            exitRequestId: wf.entityId,
            employeeId: wf.requesterId,
            lastWorkingDay: approvedLwd,
            offboardingStatus: 'CLEARANCES_PENDING',
            clearanceStatus: 'PENDING',
            accessRemovalStatus: 'ACTIVE',
            assetStatus: 'PENDING',
            hrCompletionStatus: 'IN_PROGRESS',
            processedBy: currentUser.id,
            notes: reason || 'Resignation approved and offboarding workflow initiated.',
          });

          // Auto-provision standard departmental clearance tasks if not existing
          const existingTasks = await exitRepository.findClearancesByRequestId(wf.entityId);
          if (!existingTasks || existingTasks.length === 0) {
            const defaultTasks = [
              {
                orgId: currentUser.orgId,
                exitRequestId: wf.entityId,
                employeeId: wf.requesterId,
                checklistCategory: 'ASSETS_RETURNED',
                departmentScope: 'IT',
                taskTitle: 'Laptop, Monitor & Hardware Asset Handover',
                description: 'Physical inspection and recovery of company issued hardware.',
              },
              {
                orgId: currentUser.orgId,
                exitRequestId: wf.entityId,
                employeeId: wf.requesterId,
                checklistCategory: 'IT_ACCESS',
                departmentScope: 'IT',
                taskTitle: 'VPN, Cloud & Email Account Revocation Review',
                description: 'Audit of active single sign-on (SSO) and privileged credentials.',
              },
              {
                orgId: currentUser.orgId,
                exitRequestId: wf.entityId,
                employeeId: wf.requesterId,
                checklistCategory: 'FINANCE_PAYROLL',
                departmentScope: 'FINANCE',
                taskTitle: 'Corporate Credit Card & Travel Advance Settlement',
                description: 'Verification of pending travel expenses, corporate cards, and advances.',
              },
              {
                orgId: currentUser.orgId,
                exitRequestId: wf.entityId,
                employeeId: wf.requesterId,
                checklistCategory: 'GENERAL',
                departmentScope: 'ADMIN',
                taskTitle: 'Building Access Keycard & Physical ID Badge Return',
                description: 'Recovery of security badges, parking permits, and facility keys.',
              },
              {
                orgId: currentUser.orgId,
                exitRequestId: wf.entityId,
                employeeId: wf.requesterId,
                checklistCategory: 'KNOWLEDGE_TRANSFER',
                departmentScope: 'MANAGER',
                taskTitle: 'Project Knowledge Transfer & Code Repository Sign-Off',
                description: 'Complete KT handover to designated team members and documentation update.',
              },
              {
                orgId: currentUser.orgId,
                exitRequestId: wf.entityId,
                employeeId: wf.requesterId,
                checklistCategory: 'HR_CLEARANCE',
                departmentScope: 'HR',
                taskTitle: 'Exit Interview & Benefits Termination Guidance',
                description: 'Formal exit interview, insurance continuation options, and PF/gratuity guidance.',
              },
            ];
            await exitRepository.createClearanceBatch(defaultTasks);
          }
        } else if (wf.currentStage === 'CLEARANCE_IN_PROGRESS') {
          await exitRepository.update(wf.entityId, {
            currentStage: 'FNF_PENDING',
          });
          await exitRepository.updateOffboarding(wf.entityId, {
            clearanceStatus: 'CLEARED',
            offboardingStatus: 'FNF_PENDING',
          });
        } else if (wf.currentStage === 'FNF_PENDING') {
          // Conclude exit and offboarding
          const exitRec = await exitRepository.findById(wf.entityId);
          const finalLwd = exitRec
            ? exitRec.approvedLastWorkingDay || exitRec.requestedLastWorkingDay
            : new Date().toISOString().split('T')[0];

          await exitRepository.update(wf.entityId, {
            status: 'COMPLETED',
            currentStage: 'COMPLETED',
          });
          await exitRepository.upsertOffboarding({
            orgId: currentUser.orgId,
            exitRequestId: wf.entityId,
            employeeId: wf.requesterId,
            lastWorkingDay: finalLwd,
            offboardingStatus: 'COMPLETED',
            clearanceStatus: 'CLEARED',
            accessRemovalStatus: 'DEPROVISIONED',
            assetStatus: 'RETURNED',
            hrCompletionStatus: 'COMPLETED',
            completedDate: new Date().toISOString().split('T')[0],
            completedAt: new Date().toISOString(),
            processedBy: currentUser.id,
            notes: reason || 'Exit lifecycle concluded and offboarding completed.',
          });
          await employeeRepository.update(wf.requesterId, { status: 'Exited' });
          if (targetEmp && targetEmp.userId) {
            await userRepository.update(targetEmp.userId, { status: 'Inactive' });
          }
        }
      } else if (action === 'DEPROVISION') {
        if (targetEmp) {
          // Mark employee as Exited
          await employeeRepository.update(targetEmp.id, { status: 'Exited' });
        }

        if (targetEmp && targetEmp.userId) {
          const userRec = await userRepository.findById(targetEmp.userId);
          const prevUserStatus = userRec ? userRec.status : 'Active';
          await userRepository.update(targetEmp.userId, { status: 'Inactive' });

          const interimManagerId = actionData.reassignManagerId || null;
          if (targetEmp.id) {
            await exitRepository.reassignDirectReports(currentUser.orgId, targetEmp.id, interimManagerId);
          }

          await exitRepository.recordDeprovisionAudit({
            orgId: currentUser.orgId,
            exitRequestId: wf.entityId,
            employeeId: targetEmp.id,
            userId: targetEmp.userId,
            actorUserId: currentUser.id,
            actorRole: currentUser.roleName || 'HR',
            action: 'DEPROVISION_ACCESS',
            previousUserStatus: prevUserStatus,
            newUserStatus: 'Inactive',
            previousEmployeeStatus: targetEmp.status || 'Notice Period',
            newEmployeeStatus: 'Exited',
            reassignedManagerId: interimManagerId,
            reason: reason || 'System access deprovisioned via workflow action.',
          });

          await notificationService.notifyDeprovisioningExecuted({
            orgId: currentUser.orgId,
            exitId: wf.entityId,
            employeeUserId: targetEmp.userId,
          });
        }
        await exitRepository.updateOffboarding(wf.entityId, {
          accessRemovalStatus: 'DEPROVISIONED',
          processedBy: currentUser.id,
        });
      } else if (action === 'REJECT') {
        await exitRepository.update(wf.entityId, {
          status: 'REJECTED',
          currentStage: 'REJECTED',
          hrComments: reason,
        });
        await employeeRepository.update(wf.requesterId, { status: 'Active' });
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
      if (wf.entityType === 'EXIT_REQUEST') {
        if (wf.currentStage === 'MANAGER_REVIEW' && (action === 'APPROVE' || action === 'REVIEW' || action === 'SUBMIT_REVIEW')) {
          const hrUsersRes = await pool.query(
            `SELECT u.id FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.org_id = $1 AND r.name IN ('HR', 'HRManager', 'Admin') AND u.status = 'Active';`,
            [currentUser.orgId]
          );
          const hrUserIds = hrUsersRes.rows.map((r) => r.id);
          if (hrUserIds.length > 0 && targetEmp) {
            await notificationService.notifyExitReviewPending({
              orgId: currentUser.orgId,
              exitId: wf.entityId,
              employeeName: `${targetEmp.firstName} ${targetEmp.lastName}`.trim(),
              hrUserIds,
            });
          }
        } else if (wf.currentStage === 'HR_REVIEW' && action === 'APPROVE') {
          if (targetEmp && targetEmp.userId) {
            await notificationService.notifyExitApproved({
              orgId: currentUser.orgId,
              exitId: wf.entityId,
              approvedLwd: actionData.approvedLastWorkingDay || (targetEmp.requestedLastWorkingDay || new Date().toISOString().split('T')[0]),
              employeeUserId: targetEmp.userId,
            });
          }
        } else if (action === 'DEPROVISION') {
          if (targetEmp && targetEmp.userId) {
            await notificationService.notifyDeprovisioningExecuted({
              orgId: currentUser.orgId,
              exitId: wf.entityId,
              employeeUserId: targetEmp.userId,
            });
          }
        } else if (toStatus === 'COMPLETED') {
          if (targetEmp && targetEmp.userId) {
            await notificationService.notifyExitCompleted({
              orgId: currentUser.orgId,
              exitId: wf.entityId,
              employeeUserId: targetEmp.userId,
            });
          }
        } else if (toStatus === 'REJECTED') {
          if (targetEmp && targetEmp.userId) {
            await notificationService.notifyExitRejected({
              orgId: currentUser.orgId,
              exitId: wf.entityId,
              reason: reason || 'Exit request rejected.',
              employeeUserId: targetEmp.userId,
            });
          }
        }
      } else if (targetEmp && targetEmp.userId) {
        let notifTitle = `Workflow Action: ${action} on ${wf.entityType.replace('_', ' ')}`;
        let notifMsg = `Your ${wf.entityType.replace('_', ' ').toLowerCase()} has transitioned to status '${toStatus}'.`;
        if (reason) notifMsg += ` Reason/Notes: "${reason}".`;

        let semanticEventType = 'GENERAL_ALERT';
        if (wf.entityType === 'LEAVE_REQUEST') {
          semanticEventType = action === 'APPROVE' ? 'LEAVE_APPROVED' : action === 'REJECT' ? 'LEAVE_REJECTED' : 'LEAVE_APPROVAL_PENDING';
        } else if (wf.entityType === 'PERFORMANCE_REVIEW') {
          semanticEventType = action === 'APPROVE' ? 'PERFORMANCE_APPROVED' : action === 'RETURN' ? 'PERFORMANCE_RETURNED' : action === 'REJECT' ? 'PERFORMANCE_REJECTED' : 'PERFORMANCE_REVIEW_PENDING';
        }

        await notificationService.createSystemNotification({
          orgId: currentUser.orgId,
          userId: targetEmp.userId,
          eventType: semanticEventType,
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
