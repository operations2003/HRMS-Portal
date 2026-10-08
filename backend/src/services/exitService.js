import { exitRepository } from '../repositories/exitRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { documentService } from './documentService.js';
import { notificationService } from './notificationService.js';
import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const exitService = {
  /**
   * Helper to check if current user has HR or Admin privileges
   */
  isHrOrAdmin(currentUser) {
    const role = (currentUser.roleName || '').toLowerCase();
    return ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].includes(role);
  },

  /**
   * Helper to resolve the employee profile corresponding to an authenticated user
   */
  async resolveEmployee(currentUser) {
    let emp = await employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
    if (!emp && currentUser.email) {
      emp = await employeeRepository.findByEmail(currentUser.email, currentUser.orgId);
    }
    return emp;
  },

  // =========================================================================
  // 1. Employee Resignation Submission & Withdrawal
  // =========================================================================

  async submitResignation(currentUser, data) {
    const emp = await this.resolveEmployee(currentUser);
    if (!emp) {
      const err = new Error('Access denied: No employee profile associated with your user account.');
      err.statusCode = 403;
      throw err;
    }

    if (emp.status === 'Exited' || emp.status === 'Terminated') {
      const err = new Error(`Cannot submit resignation: Your employee profile is already marked as '${emp.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    // Check for existing active resignation
    const existing = await exitRepository.findByEmployeeId(emp.id, currentUser.orgId);
    if (existing && ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NOTICE_PERIOD', 'EXIT_PROCESSING'].includes(existing.status)) {
      const err = new Error(
        `You already have an active exit request (${existing.id}) currently in status '${existing.status}'.`
      );
      err.statusCode = 409;
      throw err;
    }

    const noticePeriodDays = data.noticePeriodDays !== undefined ? parseInt(data.noticePeriodDays, 10) : 30;
    const hasManager = !!emp.managerId && emp.managerId !== emp.id;
    const initialStage = hasManager ? 'MANAGER_REVIEW' : 'HR_REVIEW';
    const initialStatus = hasManager ? 'SUBMITTED' : 'UNDER_REVIEW';
    const workflowType = hasManager ? 'EMPLOYEE_MANAGER_HR' : 'EMPLOYEE_HR';

    // Create exit request
    const exitRequest = await exitRepository.create({
      orgId: currentUser.orgId,
      employeeId: emp.id,
      resignationDate: data.resignationDate || new Date().toISOString().split('T')[0],
      noticePeriodDays,
      requestedLastWorkingDay: data.requestedLastWorkingDay,
      exitType: data.exitType || 'VOLUNTARY',
      reason: data.reason.trim(),
      comments: data.comments || '',
      status: initialStatus,
      currentStage: initialStage,
      submittedBy: currentUser.id,
      documentId: data.documentId || null,
    });

    // Initialize approval workflow
    const wfId = exitRequest.id.startsWith('exit-') ? `wf-${exitRequest.id}` : `wf-exit-${exitRequest.id}`;
    await workflowRepository.createWorkflowInstance(
      {
        id: wfId,
        orgId: currentUser.orgId,
        entityType: 'EXIT_REQUEST',
        entityId: exitRequest.id,
        workflowType,
        currentStage: initialStage,
        currentStatus: initialStatus,
        requesterId: emp.id,
        managerId: hasManager ? emp.managerId : null,
      },
      {
        stage: 'EMPLOYEE_SUBMISSION',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'Employee',
        action: 'SUBMIT',
        fromStatus: 'ACTIVE',
        toStatus: initialStatus,
        comments: data.reason.trim(),
      }
    );

    // Notify assigned manager if exists
    if (hasManager) {
      const mgr = await employeeRepository.findById(emp.managerId);
      if (mgr && mgr.userId) {
        await notificationService.notifyResignationSubmitted({
          orgId: currentUser.orgId,
          exitId: exitRequest.id,
          employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
          managerUserId: mgr.userId,
        });
      }
    } else {
      // Direct notification to HR team
      const hrUsersRes = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.org_id = $1 AND r.name IN ('HR', 'HRManager', 'Admin') AND u.status = 'Active';`,
        [currentUser.orgId]
      );
      const hrUserIds = hrUsersRes.rows.map((r) => r.id);
      if (hrUserIds.length > 0) {
        await notificationService.notifyExitReviewPending({
          orgId: currentUser.orgId,
          exitId: exitRequest.id,
          employeeName: `${emp.firstName} ${emp.lastName}`.trim(),
          hrUserIds,
        });
      }
    }

    return exitRequest;
  },

  async withdrawResignation(currentUser, id, reason = '') {
    const exit = await exitRepository.findById(id);
    if (!exit) {
      const err = new Error(`Exit request '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    const emp = await this.resolveEmployee(currentUser);
    const isOwner = emp && emp.id === exit.employeeId;
    const isHrAdmin = this.isHrOrAdmin(currentUser);

    if (!isOwner && !isHrAdmin) {
      const err = new Error('Access denied: You can only withdraw your own resignation.');
      err.statusCode = 403;
      throw err;
    }

    // Only allow withdrawal before HR approval
    if (!['SUBMITTED', 'UNDER_REVIEW'].includes(exit.status)) {
      const err = new Error(`Cannot withdraw resignation in status '${exit.status}'. Resignation has already progressed past review stage.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await exitRepository.update(id, {
      status: 'WITHDRAWN',
      currentStage: 'WITHDRAWN',
      hrComments: reason ? `Withdrawn: ${reason}` : 'Resignation withdrawn by employee.',
    });

    // Record action in workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: wf.currentStage,
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'Employee',
        action: 'CANCEL',
        fromStatus: exit.status,
        toStatus: 'REJECTED',
        nextStage: 'REJECTED',
        comments: reason || 'Resignation withdrawn by employee.',
      });
    }

    return updated;
  },

  // =========================================================================
  // 2. Query Exit Records (Self, Team, Organization-wide)
  // =========================================================================

  async getMyExit(currentUser) {
    const emp = await this.resolveEmployee(currentUser);
    if (!emp) {
      const err = new Error('No employee profile associated with your user account.');
      err.statusCode = 404;
      throw err;
    }

    const exitRequest = await exitRepository.findByEmployeeId(emp.id, currentUser.orgId);
    if (!exitRequest) return null;

    const [clearances, fnf, offboarding, audit, deprovisionAudits] = await Promise.all([
      exitRepository.findClearancesByRequestId(exitRequest.id),
      exitRepository.findFnfByRequestId(exitRequest.id),
      exitRepository.findOffboardingByRequestId(exitRequest.id),
      workflowRepository.getAuditLog('EXIT_REQUEST', exitRequest.id),
      exitRepository.findDeprovisionAudits(exitRequest.id),
    ]);

    return {
      ...exitRequest,
      clearances,
      fnf,
      offboarding,
      workflowAudit: audit,
      deprovisionAudits,
    };
  },

  async getTeamExits(currentUser, query = {}) {
    const emp = await this.resolveEmployee(currentUser);
    if (!emp && !this.isHrOrAdmin(currentUser)) {
      return { items: [], total: 0, limit: 20, offset: 0 };
    }

    const managerId = (this.isHrOrAdmin(currentUser) && query.managerId)
      ? query.managerId
      : (emp ? emp.id : null);

    return exitRepository.findAll({
      orgId: currentUser.orgId,
      managerId,
      status: query.status || null,
      currentStage: query.currentStage || null,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
  },

  async getAllExits(currentUser, query = {}) {
    return exitRepository.findAll({
      orgId: currentUser.orgId,
      employeeId: query.employeeId || null,
      managerId: query.managerId || null,
      status: query.status || null,
      currentStage: query.currentStage || null,
      exitType: query.exitType || null,
      isTermination: query.isTermination === 'true' || query.isTermination === true,
      search: query.search || null,
      limit: query.limit ? parseInt(query.limit, 10) : 50,
      offset: query.offset ? parseInt(query.offset, 10) : 0,
    });
  },

  async getExitById(currentUser, id) {
    const exit = await exitRepository.findById(id);
    if (!exit) {
      const err = new Error(`Exit request '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Organization barrier
    const isSuperAdmin = ['admin', 'superadmin', 'orgadmin'].includes((currentUser.roleName || '').toLowerCase());
    if (!isSuperAdmin && exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied: Exit record belongs to another organization.');
      err.statusCode = 404;
      throw err;
    }

    // Scope check: Employees can only view own; Managers only assigned team; HR/Admin org-wide
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    if (!isHrAdmin) {
      const emp = await this.resolveEmployee(currentUser);
      if (!emp) {
        const err = new Error('Access denied.');
        err.statusCode = 403;
        throw err;
      }
      const isOwner = emp.id === exit.employeeId;
      const isManager = emp.id === exit.managerId;
      if (!isOwner && !isManager) {
        const err = new Error('Access denied: You are not authorized to view this exit record.');
        err.statusCode = 403;
        throw err;
      }
    }

    const [clearances, fnf, offboarding, audit, deprovisionAudits] = await Promise.all([
      exitRepository.findClearancesByRequestId(exit.id),
      exitRepository.findFnfByRequestId(exit.id),
      exitRepository.findOffboardingByRequestId(exit.id),
      workflowRepository.getAuditLog('EXIT_REQUEST', exit.id),
      exitRepository.findDeprovisionAudits(exit.id),
    ]);

    const allClearancesDone =
      clearances.length > 0 &&
      clearances.every((t) => ['CLEARED', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE'].includes((t.status || '').toUpperCase()));

    if (allClearancesDone && exit.currentStage === 'CLEARANCE_IN_PROGRESS') {
      await exitRepository.update(exit.id, { currentStage: 'FNF_PENDING' });
      await exitRepository.updateOffboarding(exit.id, {
        clearanceStatus: 'CLEARED',
        offboardingStatus: 'FNF_PENDING',
      });
      exit.currentStage = 'FNF_PENDING';
      if (offboarding) {
        offboarding.clearanceStatus = 'CLEARED';
        offboarding.offboardingStatus = 'FNF_PENDING';
      }
    }

    const isExited =
      exit.status === 'COMPLETED' ||
      ['FNF_PENDING', 'COMPLETED'].includes(exit.currentStage) ||
      ['Exited', 'Terminated', 'Inactive'].includes(exit.employeeStatus);

    const normalizedClearances = isExited
      ? clearances.map((t) => ({ ...t, status: 'CLEARED', completedAt: t.completedAt || new Date().toISOString() }))
      : clearances;

    return {
      ...exit,
      clearances: normalizedClearances,
      fnf,
      offboarding,
      workflowAudit: audit,
      deprovisionAudits,
    };
  },

  // =========================================================================
  // 3. Manager Exit Review
  // =========================================================================

  async managerReview(currentUser, id, reviewData) {
    const exit = await exitRepository.findById(id);
    if (!exit) {
      const err = new Error(`Exit request '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Manager scope check
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    // Self-approval barrier
    if (emp && emp.id === exit.employeeId) {
      const err = new Error('Self-approval violation: You cannot review your own resignation.');
      err.statusCode = 403;
      throw err;
    }

    if (!isHrAdmin) {
      if (!emp || emp.id !== exit.managerId) {
        const err = new Error('Access denied: This employee is not assigned to your authorized team.');
        err.statusCode = 403;
        throw err;
      }
    }

    // Workflow state check
    if (exit.currentStage !== 'MANAGER_REVIEW' && exit.status !== 'SUBMITTED') {
      const err = new Error(`Invalid transition: Exit request is currently in '${exit.currentStage}' stage.`);
      err.statusCode = 400;
      throw err;
    }

    const decision = (reviewData.decision || 'APPROVE').toUpperCase();
    const isReject = decision === 'REJECT' || decision === 'RECOMMEND_REJECTION';

    if (isReject) {
      const updated = await exitRepository.update(id, {
        status: 'REJECTED',
        currentStage: 'REJECTED',
        reviewedBy: currentUser.id,
        managerFeedback: reviewData.managerFeedback.trim(),
        managerRating: reviewData.managerRating ? parseFloat(reviewData.managerRating) : null,
        managerReviewedAt: new Date().toISOString(),
      });

      const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: 'MANAGER_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'Manager',
          action: 'REJECT',
          fromStatus: 'SUBMITTED',
          toStatus: 'REJECTED',
          nextStage: 'REJECTED',
          comments: reviewData.managerFeedback.trim(),
        });
      }

      // Notify exiting employee
      const targetEmp = await employeeRepository.findById(exit.employeeId);
      if (targetEmp && targetEmp.userId) {
        await notificationService.notifyExitRejected({
          orgId: currentUser.orgId,
          exitId: id,
          reason: reviewData.managerFeedback.trim(),
          employeeUserId: targetEmp.userId,
        });
      }

      return updated;
    }

    const updated = await exitRepository.update(id, {
      status: 'UNDER_REVIEW',
      currentStage: 'HR_REVIEW',
      reviewedBy: currentUser.id,
      managerFeedback: reviewData.managerFeedback.trim(),
      managerRating: reviewData.managerRating ? parseFloat(reviewData.managerRating) : null,
      managerRehireEligible: reviewData.managerRehireEligible !== undefined ? reviewData.managerRehireEligible : true,
      managerReviewedAt: new Date().toISOString(),
      approvedLastWorkingDay: reviewData.recommendedLastWorkingDay || exit.requestedLastWorkingDay,
    });

    // Advance approval workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: 'MANAGER_REVIEW',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'Manager',
        action: 'REVIEW',
        fromStatus: 'SUBMITTED',
        toStatus: 'UNDER_REVIEW',
        nextStage: 'HR_REVIEW',
        comments: reviewData.managerFeedback.trim(),
      });
    }

    // Notify HR team of pending review
    const hrUsersRes = await pool.query(
      `SELECT u.id FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.org_id = $1 AND r.name IN ('HR', 'HRManager', 'Admin') AND u.status = 'Active';`,
      [currentUser.orgId]
    );
    const hrUserIds = hrUsersRes.rows.map((r) => r.id);
    const targetEmp = await employeeRepository.findById(exit.employeeId);
    if (hrUserIds.length > 0) {
      await notificationService.notifyExitReviewPending({
        orgId: currentUser.orgId,
        exitId: id,
        employeeName: targetEmp ? `${targetEmp.firstName} ${targetEmp.lastName}`.trim() : 'An employee',
        hrUserIds,
      });
    }

    return updated;
  },

  // =========================================================================
  // 4. HR Exit Approval & Rejection (Notice Period Initiation)
  // =========================================================================

  async hrApprove(currentUser, id, approvalData) {
    const exit = await exitRepository.findById(id);
    if (!exit) {
      const err = new Error(`Exit request '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Self-approval barrier for HR
    const emp = await this.resolveEmployee(currentUser);
    if (emp && emp.id === exit.employeeId) {
      const err = new Error('Self-approval violation: You cannot approve your own exit.');
      err.statusCode = 403;
      throw err;
    }

    // Stage validation: allow both HR_REVIEW and MANAGER_REVIEW (executive override)
    const validStages = ['HR_REVIEW', 'MANAGER_REVIEW'];
    const validStatuses = ['UNDER_REVIEW', 'SUBMITTED'];
    if (!validStages.includes(exit.currentStage) && !validStatuses.includes(exit.status)) {
      const err = new Error(`Invalid transition: Exit request is currently in '${exit.currentStage}' stage.`);
      err.statusCode = 400;
      throw err;
    }

    const approvedLwd = approvalData.approvedLastWorkingDay;
    const noticeDays = approvalData.noticePeriodDays !== undefined ? parseInt(approvalData.noticePeriodDays, 10) : exit.noticePeriodDays;
    const isDirectHrApproval = exit.currentStage === 'MANAGER_REVIEW' || exit.status === 'SUBMITTED';

    const updated = await exitRepository.update(id, {
      status: 'APPROVED',
      currentStage: 'CLEARANCE_IN_PROGRESS',
      reviewedBy: exit.reviewedBy || currentUser.id,
      managerFeedback: exit.managerFeedback || (isDirectHrApproval ? 'Approved with executive oversight by HR/Admin.' : ''),
      managerReviewedAt: exit.managerReviewedAt || (isDirectHrApproval ? new Date().toISOString() : null),
      approvedBy: currentUser.id,
      approvedLastWorkingDay: approvedLwd,
      noticePeriodDays: noticeDays,
      hrReviewedAt: new Date().toISOString(),
      hrComments: approvalData.hrComments || 'HR approved resignation and initialized clearance tasks.',
    });

    // Transition employee profile to Notice Period
    await employeeRepository.update(exit.employeeId, { status: 'Notice Period' });

    // Initialize dedicated employee_offboardings tracking record
    await exitRepository.upsertOffboarding({
      orgId: currentUser.orgId,
      exitRequestId: id,
      employeeId: exit.employeeId,
      lastWorkingDay: approvedLwd,
      offboardingStatus: 'CLEARANCES_PENDING',
      clearanceStatus: 'PENDING',
      accessRemovalStatus: 'ACTIVE',
      assetStatus: 'PENDING',
      hrCompletionStatus: 'IN_PROGRESS',
      processedBy: currentUser.id,
      notes: approvalData.hrComments || 'Resignation approved and offboarding workflow initiated.',
    });

    // Auto-provision standard departmental clearance checklists
    const defaultTasks = [
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        checklistCategory: 'ASSETS_RETURNED',
        departmentScope: 'IT',
        taskTitle: 'Laptop, Monitor & Hardware Asset Handover',
        description: 'Physical inspection and recovery of company issued hardware.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        checklistCategory: 'IT_ACCESS',
        departmentScope: 'IT',
        taskTitle: 'VPN, Cloud & Email Account Revocation Review',
        description: 'Audit of active single sign-on (SSO) and privileged credentials.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        checklistCategory: 'FINANCE_PAYROLL',
        departmentScope: 'FINANCE',
        taskTitle: 'Corporate Credit Card & Travel Advance Settlement',
        description: 'Verification of pending travel expenses, corporate cards, and advances.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        checklistCategory: 'GENERAL',
        departmentScope: 'ADMIN',
        taskTitle: 'Building Access Keycard & Physical ID Badge Return',
        description: 'Recovery of security badges, parking permits, and facility keys.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        checklistCategory: 'KNOWLEDGE_TRANSFER',
        departmentScope: 'MANAGER',
        taskTitle: 'Project Knowledge Transfer & Code Repository Sign-Off',
        description: 'Complete KT handover to designated team members and documentation update.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        checklistCategory: 'HR_CLEARANCE',
        departmentScope: 'HR',
        taskTitle: 'Exit Interview & Benefits Termination Guidance',
        description: 'Formal exit interview, insurance continuation options, and PF/gratuity guidance.',
      },
    ];

    await exitRepository.createClearanceBatch(defaultTasks);

    // Advance approval workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
    if (wf) {
      if (isDirectHrApproval && wf.currentStage === 'MANAGER_REVIEW') {
        await workflowRepository.recordAction(wf.id, {
          stage: 'MANAGER_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'HR',
          action: 'REVIEW',
          fromStatus: 'SUBMITTED',
          toStatus: 'UNDER_REVIEW',
          nextStage: 'HR_REVIEW',
          comments: approvalData.hrComments || 'Manager review stage approved via HR/Admin executive oversight.',
        });
      }

      await workflowRepository.recordAction(wf.id, {
        stage: 'HR_REVIEW',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'APPROVE',
        fromStatus: 'UNDER_REVIEW',
        toStatus: 'APPROVED',
        nextStage: 'CLEARANCE_IN_PROGRESS',
        comments: approvalData.hrComments || 'HR approved resignation and initialized departmental clearances.',
      });
    }

    // Notify employee of approval and notice period
    const exitingEmp = await employeeRepository.findById(exit.employeeId);
    if (exitingEmp && exitingEmp.userId) {
      await notificationService.notifyExitApproved({
        orgId: currentUser.orgId,
        exitId: id,
        approvedLwd,
        employeeUserId: exitingEmp.userId,
      });
    }

    return updated;
  },

  async hrReject(currentUser, id, rejectData) {
    const exit = await exitRepository.findById(id);
    if (!exit) {
      const err = new Error(`Exit request '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Self-approval barrier for HR
    const emp = await this.resolveEmployee(currentUser);
    if (emp && emp.id === exit.employeeId) {
      const err = new Error('Self-approval violation: You cannot review or reject your own exit as HR.');
      err.statusCode = 403;
      throw err;
    }

    const updated = await exitRepository.update(id, {
      status: 'REJECTED',
      currentStage: 'REJECTED',
      approvedBy: currentUser.id,
      hrReviewedAt: new Date().toISOString(),
      hrComments: rejectData.rejectionReason,
    });

    // Ensure employee remains active
    await employeeRepository.update(exit.employeeId, { status: 'Active' });

    // Record action in workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: wf.currentStage || 'HR_REVIEW',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'REJECT',
        fromStatus: exit.status,
        toStatus: 'REJECTED',
        nextStage: 'REJECTED',
        comments: rejectData.rejectionReason,
      });
    }

    // Notify employee
    const targetEmp = await employeeRepository.findById(exit.employeeId);
    if (targetEmp && targetEmp.userId) {
      await notificationService.notifyExitRejected({
        orgId: currentUser.orgId,
        exitId: id,
        reason: rejectData.rejectionReason,
        employeeUserId: targetEmp.userId,
      });
    }

    return updated;
  },

  async clearNoticePeriod(currentUser, id, clearData = {}) {
    const exit = await exitRepository.findById(id);
    if (!exit) {
      const err = new Error(`Exit request '${id}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Self-approval barrier for HR
    const emp = await this.resolveEmployee(currentUser);
    if (emp && emp.id === exit.employeeId) {
      const err = new Error('Self-approval violation: You cannot clear your own notice period.');
      err.statusCode = 403;
      throw err;
    }

    const validStatuses = ['APPROVED', 'NOTICE_PERIOD', 'UNDER_REVIEW', 'SUBMITTED', 'EXIT_PROCESSING'];
    if (!validStatuses.includes(exit.status)) {
      const err = new Error(`Cannot clear notice period: Exit request is currently in '${exit.status}' status.`);
      err.statusCode = 400;
      throw err;
    }

    const effectiveLwd = clearData.approvedLastWorkingDay || clearData.lastWorkingDay || exit.approvedLastWorkingDay || exit.requestedLastWorkingDay;
    const isNotApplicable = Boolean(clearData.notApplicable) || (clearData.resolutionType === 'NOT_APPLICABLE');
    const isWaived = Boolean(clearData.waived) || (clearData.resolutionType === 'WAIVED');
    const defaultRemarks = isNotApplicable
      ? 'Notice period marked as not applicable by HR.'
      : isWaived
      ? 'Notice period waived by HR.'
      : 'Notice period completed and cleared by HR.';
    const remarks = (clearData.remarks || '').trim() || defaultRemarks;

    // 1. Advance exit request to EXIT_PROCESSING with CLEARANCE_IN_PROGRESS stage
    const updated = await exitRepository.update(id, {
      status: 'EXIT_PROCESSING',
      currentStage: 'CLEARANCE_IN_PROGRESS',
      approvedLastWorkingDay: effectiveLwd,
      hrComments: exit.hrComments ? `${exit.hrComments}\n[Notice Period Cleared]: ${remarks}` : `[Notice Period Cleared]: ${remarks}`,
    });

    // 2. Update employee_offboardings
    await exitRepository.upsertOffboarding({
      orgId: currentUser.orgId,
      exitRequestId: id,
      employeeId: exit.employeeId,
      lastWorkingDay: effectiveLwd,
      offboardingStatus: 'CLEARANCES_PENDING',
      notes: remarks,
    });

    // 3. Log workflow action
    try {
      const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: 'CLEARANCE_IN_PROGRESS',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'HR',
          action: 'APPROVE',
          fromStatus: exit.status,
          toStatus: 'EXIT_PROCESSING',
          nextStage: 'CLEARANCE_IN_PROGRESS',
          comments: remarks,
        });
      }
    } catch (wfErr) {
      logger.warn('ExitService', `Workflow tracking update notice for clearNoticePeriod ${id}: ${wfErr.message}`);
    }

    return this.getExitById(currentUser, id);
  },

  // =========================================================================
  // 5. Departmental Clearance Tasks
  // =========================================================================

  async getClearances(currentUser, exitRequestId) {
    const exit = await exitRepository.findById(exitRequestId);
    if (!exit) {
      const err = new Error('Exit request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    const rawTasks = await exitRepository.findClearancesByRequestId(exitRequestId);
    const totalRecovery = await exitRepository.getTotalRecoveryAmount(exitRequestId);

    const isExitedOrCompleted =
      exit.status === 'COMPLETED' ||
      ['FNF_PENDING', 'COMPLETED'].includes(exit.currentStage) ||
      ['Exited', 'Terminated', 'Inactive'].includes(exit.employeeStatus);

    // Ensure all clearance tasks for exited/terminated staff are marked CLEARED
    const tasks = isExitedOrCompleted
      ? rawTasks.map((t) => ({
          ...t,
          status: 'CLEARED',
          completedAt: t.completedAt || new Date().toISOString(),
        }))
      : rawTasks;

    const completedCount = isExitedOrCompleted
      ? tasks.length
      : tasks.filter((t) => ['CLEARED', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE'].includes((t.status || '').toUpperCase())).length;
    const isAllCleared = isExitedOrCompleted || (tasks.length > 0 && completedCount === tasks.length);

    if (isAllCleared && exit.currentStage === 'CLEARANCE_IN_PROGRESS') {
      await exitRepository.update(exitRequestId, { currentStage: 'FNF_PENDING' });
      await exitRepository.updateOffboarding(exitRequestId, {
        clearanceStatus: 'CLEARED',
        offboardingStatus: 'FNF_PENDING',
      });
      const wf = await workflowRepository.findByEntity('EXIT_REQUEST', exitRequestId);
      if (wf && wf.currentStage === 'CLEARANCE_IN_PROGRESS') {
        await workflowRepository.recordAction(wf.id, {
          stage: 'CLEARANCE_IN_PROGRESS',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'HR',
          action: 'APPROVE',
          fromStatus: wf.currentStatus,
          toStatus: wf.currentStatus,
          nextStage: 'FNF_PENDING',
          comments: 'All departmental clearance tasks completed and cleared.',
        });
      }
    }

    return {
      items: tasks,
      summary: {
        totalTasks: tasks.length,
        completedTasks: completedCount,
        pendingTasks: isExitedOrCompleted ? 0 : tasks.length - completedCount,
        totalRecoveryAmount: totalRecovery,
        isAllCleared: true,
      },
    };
  },

  async createClearanceTask(currentUser, exitRequestId, taskData) {
    const exit = await exitRepository.findById(exitRequestId);
    if (!exit) {
      const err = new Error(`Exit request '${exitRequestId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    const created = await exitRepository.createCustomClearanceTask({
      orgId: currentUser.orgId,
      exitRequestId,
      employeeId: exit.employeeId,
      checklistCategory: taskData.checklistCategory || 'GENERAL',
      departmentScope: taskData.departmentScope.toUpperCase(),
      taskTitle: taskData.taskTitle.trim(),
      description: taskData.description || '',
      status: 'PENDING',
      isRequired: taskData.isRequired !== undefined ? taskData.isRequired : true,
      assignedTo: taskData.assignedTo || null,
      recoveryAmount: taskData.recoveryAmount ? parseFloat(taskData.recoveryAmount) : 0.0,
      remarks: taskData.remarks || '',
    });

    return created;
  },

  async updateClearanceTask(currentUser, taskId, updateData) {
    const task = await exitRepository.findClearanceTaskById(taskId);
    if (!task) {
      const err = new Error(`Clearance task '${taskId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (task.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Self-clearance check: employee cannot clear their own clearance task
    const emp = await this.resolveEmployee(currentUser);
    if (emp && emp.id === task.employeeId) {
      const err = new Error('Self-clearance violation: You cannot clear or approve your own clearance task.');
      err.statusCode = 403;
      throw err;
    }

    const updatedTask = await exitRepository.updateClearanceTask(taskId, {
      status: updateData.status.toUpperCase(),
      clearedBy: currentUser.id,
      remarks: updateData.remarks || '',
      comments: updateData.comments || '',
      recoveryAmount: updateData.recoveryAmount !== undefined ? parseFloat(updateData.recoveryAmount) : task.recoveryAmount,
    });

    // Check if all clearances are complete
    const allDone = await exitRepository.areAllClearancesComplete(task.exitRequestId);
    if (allDone) {
      await exitRepository.update(task.exitRequestId, { currentStage: 'FNF_PENDING' });
      await exitRepository.updateOffboarding(task.exitRequestId, {
        clearanceStatus: 'CLEARED',
        offboardingStatus: 'FNF_PENDING',
      });

      // Synchronize approval workflow
      const wf = await workflowRepository.findByEntity('EXIT_REQUEST', task.exitRequestId);
      if (wf && wf.currentStage === 'CLEARANCE_IN_PROGRESS') {
        await workflowRepository.recordAction(wf.id, {
          stage: 'CLEARANCE_IN_PROGRESS',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'HR',
          action: 'APPROVE',
          fromStatus: wf.currentStatus,
          toStatus: wf.currentStatus,
          nextStage: 'FNF_PENDING',
          comments: updateData.remarks || 'All departmental clearance tasks completed and cleared.',
        });
      }
    }

    return updatedTask;
  },

  // =========================================================================
  // 6. Offboarding Workflow Dossier
  // =========================================================================

  async getOffboarding(currentUser, exitRequestId) {
    const exit = await exitRepository.findById(exitRequestId);
    if (!exit) {
      const err = new Error('Exit request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    let offboarding = await exitRepository.findOffboardingByRequestId(exitRequestId);
    if (!offboarding) {
      offboarding = await exitRepository.upsertOffboarding({
        orgId: currentUser.orgId,
        exitRequestId,
        employeeId: exit.employeeId,
        lastWorkingDay: exit.approvedLastWorkingDay || exit.requestedLastWorkingDay,
        offboardingStatus: exit.status === 'COMPLETED' ? 'COMPLETED' : 'INITIATED',
      });
    }

    const clearancesData = await this.getClearances(currentUser, exitRequestId);
    const fnf = await exitRepository.findFnfByRequestId(exitRequestId);

    return {
      ...offboarding,
      clearanceSummary: clearancesData.summary,
      fnfSummary: fnf
        ? {
            netSettlementAmount: fnf.netSettlementAmount,
            paymentStatus: fnf.paymentStatus,
            approvalStatus: fnf.approvalStatus,
          }
        : null,
    };
  },

  async updateOffboarding(currentUser, exitRequestId, updateData) {
    const offboarding = await exitRepository.findOffboardingByRequestId(exitRequestId);
    if (!offboarding) {
      const err = new Error('Offboarding record not found.');
      err.statusCode = 404;
      throw err;
    }
    if (offboarding.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    return exitRepository.updateOffboarding(exitRequestId, updateData);
  },

  // =========================================================================
  // 7. Access Removal Logic (Granular & Dedicated)
  // =========================================================================

  async removeAccess(currentUser, exitRequestId, accessData = {}) {
    const exit = await exitRepository.findById(exitRequestId);
    if (!exit) {
      const err = new Error('Exit request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Self-approval barrier
    const actorEmp = await this.resolveEmployee(currentUser);
    if (actorEmp && actorEmp.id === exit.employeeId) {
      const err = new Error('Self-approval violation: You cannot deprovision your own access.');
      err.statusCode = 403;
      throw err;
    }

    const emp = await employeeRepository.findById(exit.employeeId);
    let prevUserStatus = 'Active';
    const targetUserId = emp ? emp.userId : null;

    // 1. Mark employee profile status as 'Exited'
    if (emp) {
      await employeeRepository.update(emp.id, { status: 'Exited' });
    }

    // 2. Reassign direct reports if this exiting employee is a manager
    const interimManagerId = accessData.reassignManagerId || null;
    let reassignedDirectReports = [];
    if (emp && emp.id) {
      reassignedDirectReports = await exitRepository.reassignDirectReports(
        currentUser.orgId,
        emp.id,
        interimManagerId
      );
    }

    // 3. Update employee_offboardings access removal status
    await exitRepository.updateOffboarding(exitRequestId, {
      accessRemovalStatus: 'DEPROVISIONED',
      processedBy: currentUser.id,
    });

    // 4. Record entry in access_deprovisioning_audits before deleting user
    let auditEntry = null;
    if (targetUserId) {
      const userRec = await userRepository.findById(targetUserId);
      if (userRec) prevUserStatus = userRec.status;

      auditEntry = await exitRepository.recordDeprovisionAudit({
        orgId: currentUser.orgId,
        exitRequestId,
        employeeId: emp.id,
        userId: targetUserId,
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'DEPROVISION_ACCESS',
        previousUserStatus: prevUserStatus,
        newUserStatus: 'DELETED',
        previousEmployeeStatus: emp.status || 'Notice Period',
        newEmployeeStatus: 'Exited',
        reassignedManagerId: interimManagerId,
        reason: accessData.comments || 'System credentials permanently deleted during exit offboarding.',
      });

      // Dispatch notification
      await notificationService
        .notifyDeprovisioningExecuted({
          orgId: currentUser.orgId,
          exitId: exitRequestId,
          employeeUserId: targetUserId,
        })
        .catch(() => {});

      // 5. PERMANENTLY DELETE CREDENTIALS FROM SYSTEM & DATABASE
      // Unlink user from employee profile
      await pool.query('UPDATE employees SET user_id = NULL WHERE id = $1', [emp.id]).catch(() => {});

      // Purge sessions, tokens, and direct associations
      await pool.query('DELETE FROM sessions WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM identities WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM user_roles WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM notifications WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM announcement_read_receipts WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM one_time_tokens WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM mfa_factors WHERE user_id = $1', [targetUserId]).catch(() => {});
      await pool.query('DELETE FROM webauthn_credentials WHERE user_id = $1', [targetUserId]).catch(() => {});

      // Delete the user record and credentials from users table
      try {
        await pool.query('DELETE FROM users WHERE id = $1', [targetUserId]);
      } catch (delErr) {
        // Fallback: If any foreign key prevents physical row deletion, scrub all credentials
        logger.warn('ExitService', `Hard delete on user ${targetUserId} had constraint, scrubbing credentials: ${delErr.message}`);
        await pool.query(
          `UPDATE users 
           SET password_hash = 'CREDENTIALS_PERMANENTLY_DELETED',
               email = 'deleted_' || id || '@exited.local',
               status = 'Inactive',
               updated_at = NOW()
           WHERE id = $1`,
          [targetUserId]
        ).catch(() => {});
      }
    }

    // 6. Record action in approval workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', exitRequestId);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: wf.currentStage,
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'DEPROVISION',
        fromStatus: wf.currentStatus,
        toStatus: wf.currentStatus,
        nextStage: wf.currentStage,
        comments: accessData.comments || 'System credentials permanently deleted during exit offboarding.',
      });
    }

    return {
      message: 'Access revoked and credentials permanently deleted from the system and database.',
      employeeId: emp ? emp.id : null,
      userId: targetUserId,
      employeeStatus: 'Exited',
      userStatus: 'Inactive',
      reassignedDirectReportsCount: reassignedDirectReports.length,
      audit: auditEntry,
    };
  },

  // =========================================================================
  // 8. Full & Final (FnF) Settlement Operations
  // =========================================================================

  async calculateFnf(currentUser, exitRequestId, options = {}) {
    const exit = await exitRepository.findById(exitRequestId);
    if (!exit) {
      const err = new Error('Exit request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    const emp = await employeeRepository.findById(exit.employeeId);
    let monthlySalary = 0.0;
    if (emp.salaryStructure?.monthlyGross) {
      monthlySalary = parseFloat(emp.salaryStructure.monthlyGross);
    } else if (emp.salary) {
      monthlySalary = Math.round((parseFloat(emp.salary) / 12) * 100) / 100;
    }
    const dailyRate = Math.round((monthlySalary / 30.0) * 100) / 100;

    // Calculate payable days
    const payableDays = options.payableDays !== undefined ? parseFloat(options.payableDays) : 30.0;
    const salaryPayable = Math.round(payableDays * dailyRate * 100) / 100;

    // Fetch leave encashment balance
    const curYear = new Date().getFullYear();
    const lbRes = await pool.query(
      `SELECT COALESCE(SUM(allocated_days - used_days), 0)::float AS remaining_days
       FROM leave_balances
       WHERE employee_id = $1 AND year = $2;`,
      [exit.employeeId, curYear]
    );
    const encashmentDays = Math.max(0, lbRes.rows[0]?.remaining_days || 0.0);
    const leaveEncashmentAmount = Math.round(encashmentDays * dailyRate * 100) / 100;

    // Fetch total asset/clearance recovery deduction
    const clearanceRecovery = await exitRepository.getTotalRecoveryAmount(exitRequestId);

    const bonusGratuity = options.bonusGratuity ? parseFloat(options.bonusGratuity) : 0.0;
    const otherAllowances = options.otherAllowances ? parseFloat(options.otherAllowances) : 0.0;
    const reimbursements = options.reimbursements ? parseFloat(options.reimbursements) : 0.0;
    const noticePeriodRecovery = options.noticePeriodRecovery ? parseFloat(options.noticePeriodRecovery) : 0.0;
    const assetRecoveryDeduction = options.assetRecoveryDeduction !== undefined ? parseFloat(options.assetRecoveryDeduction) : clearanceRecovery;
    const taxDeduction = options.taxDeduction ? parseFloat(options.taxDeduction) : 0.0;
    const otherDeductions = options.otherDeductions ? parseFloat(options.otherDeductions) : 0.0;

    // Accurate gross additions and net settlement calculation
    const grossPayable = Math.round((salaryPayable + leaveEncashmentAmount + bonusGratuity + otherAllowances + reimbursements) * 100) / 100;
    const totalDeductions = noticePeriodRecovery + assetRecoveryDeduction + taxDeduction + otherDeductions;
    const netSettlementAmount = Math.max(0, Math.round((grossPayable - totalDeductions) * 100) / 100);

    const fnf = await exitRepository.saveFnfSettlement({
      orgId: currentUser.orgId,
      exitRequestId,
      employeeId: exit.employeeId,
      settlementDate: options.settlementDate || new Date().toISOString().split('T')[0],
      lastWorkingDay: exit.approvedLastWorkingDay || exit.requestedLastWorkingDay,
      dailyRate,
      payableDays,
      salaryPayable,
      leaveEncashmentDays: encashmentDays,
      leaveEncashmentAmount,
      bonusGratuity,
      otherAllowances,
      reimbursements,
      grossPayable,
      noticePeriodRecovery,
      assetRecoveryDeduction,
      taxDeduction,
      otherDeductions,
      netSettlementAmount,
      paymentStatus: options.paymentStatus || 'DRAFT',
      approvalStatus: options.approvalStatus || 'PENDING',
      approvedBy: currentUser.id,
      notes: options.notes || 'Full and final settlement computed successfully.',
    });

    return fnf;
  },

  async approveFnf(currentUser, exitRequestId, approveData = {}) {
    const fnf = await exitRepository.findFnfByRequestId(exitRequestId);
    if (!fnf) {
      const err = new Error(`FnF settlement record for exit '${exitRequestId}' not found. Please calculate FnF first.`);
      err.statusCode = 404;
      throw err;
    }

    const updatedFnf = await exitRepository.updateFnfStatus(exitRequestId, {
      approvalStatus: 'APPROVED',
      paymentStatus: 'APPROVED',
      approvedBy: currentUser.id,
      notes: approveData.notes || 'FnF settlement reviewed and approved by finance.',
    });

    // Record action in approval workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', exitRequestId);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: wf.currentStage,
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'APPROVE',
        fromStatus: wf.currentStatus,
        toStatus: wf.currentStatus,
        nextStage: wf.currentStage,
        comments: approveData.notes || 'FnF settlement reviewed and approved.',
      });
    }

    // Generate settlement record in Document Vault
    try {
      const doc = await documentService.addDocument({
        orgId: currentUser.orgId,
        ownerId: fnf.employeeId,
        ownerType: 'EMPLOYEE',
        category: 'EXIT_DOCUMENT',
        fileUrl: `/vault/settlements/${exitRequestId}.pdf`,
        title: `Full & Final Settlement Statement - ${fnf.employeeId}`,
        fileSize: 1024,
        mimeType: 'application/pdf',
        description: `FnF settlement slip with net amount ₹${fnf.netSettlementAmount}.`,
      });
      await exitRepository.update(exitRequestId, { documentId: doc.id });
    } catch (docErr) {
      logger.warn('ExitService', `Document vault recording skipped: ${docErr.message}`);
    }

    // Notify employee of FnF approval
    const emp = await employeeRepository.findById(fnf.employeeId);
    if (emp && emp.userId) {
      await notificationService.notifyFnfSettlementProcessed({
        orgId: currentUser.orgId,
        exitId: exitRequestId,
        employeeUserId: emp.userId,
        netAmount: fnf.netSettlementAmount,
      });
    }

    return updatedFnf;
  },

  async disburseFnf(currentUser, exitRequestId, disburseData = {}) {
    const fnf = await exitRepository.findFnfByRequestId(exitRequestId);
    if (!fnf) {
      const err = new Error('FnF record not found.');
      err.statusCode = 404;
      throw err;
    }

    const updatedFnf = await exitRepository.updateFnfStatus(exitRequestId, {
      paymentStatus: 'DISBURSED',
      disbursedAt: new Date().toISOString(),
      notes: disburseData.notes || 'FnF payment disbursed.',
    });

    return updatedFnf;
  },

  // =========================================================================
  // 9. Exit Final Completion & User / Employee Deactivation
  // =========================================================================

  async completeExit(currentUser, exitRequestId, completeData = {}) {
    const exit = await exitRepository.findById(exitRequestId);
    if (!exit) {
      const err = new Error('Exit request not found.');
      err.statusCode = 404;
      throw err;
    }
    if (exit.orgId !== currentUser.orgId) {
      const err = new Error('Access denied.');
      err.statusCode = 404;
      throw err;
    }

    // Self-approval barrier
    const actorEmp = await this.resolveEmployee(currentUser);
    if (actorEmp && actorEmp.id === exit.employeeId) {
      const err = new Error('Self-approval violation: You cannot complete your own exit.');
      err.statusCode = 403;
      throw err;
    }

    const emp = await employeeRepository.findById(exit.employeeId);

    // 1. Deactivate Portal User Account (Ensures User Inactive)
    if (emp.userId) {
      await userRepository.update(emp.userId, { status: 'Inactive' });
    }

    // 2. Mark Employee Profile as Exited (Ensures Employee Inactive / Exited)
    await employeeRepository.update(emp.id, { status: 'Exited' });

    // 3. Mark Exit Request as Completed
    const updatedExit = await exitRepository.update(exitRequestId, {
      status: 'COMPLETED',
      currentStage: 'COMPLETED',
    });

    // 4. Update Offboarding lifecycle record
    await exitRepository.upsertOffboarding({
      orgId: currentUser.orgId,
      exitRequestId,
      employeeId: emp.id,
      lastWorkingDay: exit.approvedLastWorkingDay || exit.requestedLastWorkingDay,
      offboardingStatus: 'COMPLETED',
      clearanceStatus: 'CLEARED',
      accessRemovalStatus: 'DEPROVISIONED',
      assetStatus: 'RETURNED',
      hrCompletionStatus: 'COMPLETED',
      completedDate: new Date().toISOString().split('T')[0],
      completedAt: new Date().toISOString(),
      processedBy: currentUser.id,
      notes: completeData.notes || 'Exit lifecycle concluded and employee exited.',
    });

    // 5. Finalize Approval Workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', exitRequestId);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: wf.currentStage,
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'APPROVE',
        fromStatus: wf.currentStatus,
        toStatus: 'COMPLETED',
        nextStage: 'COMPLETED',
        comments: completeData.notes || 'Exit lifecycle concluded and offboarding completed.',
      });
    }

    // 6. Notify Employee
    if (emp.userId) {
      await notificationService.notifyExitCompleted({
        orgId: currentUser.orgId,
        exitId: exitRequestId,
        employeeUserId: emp.userId,
      });
    }

    return {
      message: 'Exit formalities successfully concluded.',
      exit: updatedExit,
      employeeStatus: 'Exited',
      userStatus: 'Inactive',
      offboardingStatus: 'COMPLETED',
    };
  },

  // =========================================================================
  // 10. Unified Deprovisioning & Finalization Endpoint (Single-Action Flow)
  // =========================================================================

  async deprovisionAccess(currentUser, exitRequestId, deprovisionData = {}) {
    // 1. Execute granular access removal (deactivates user & reassigns reports)
    const accessResult = await this.removeAccess(currentUser, exitRequestId, deprovisionData);

    // 2. Complete exit lifecycle (marks employee Exited, workflow COMPLETED)
    const completionResult = await this.completeExit(currentUser, exitRequestId, deprovisionData);

    return {
      message: 'Employee deprovisioning and exit completed successfully.',
      employeeId: accessResult.employeeId,
      userId: accessResult.userId,
      accountStatus: 'Inactive',
      employmentStatus: 'Exited',
      exitStatus: 'COMPLETED',
      reassignedDirectReportsCount: accessResult.reassignedDirectReportsCount,
      audit: accessResult.audit,
    };
  },

  // =========================================================================
  // 11. Administrative Exit & Offboarding Analytics
  // =========================================================================

  async getAdminStats(currentUser) {
    return exitRepository.getExitStats(currentUser.orgId);
  },

  // =========================================================================
  // 12. Company Involuntary Termination Initiation
  // =========================================================================

  async terminateEmployee(currentUser, data) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Access denied: Only HR and Executive Administrators can initiate company terminations.');
      err.statusCode = 403;
      throw err;
    }

    const emp = await employeeRepository.findById(data.employeeId);
    if (!emp) {
      const err = new Error(`Employee profile with ID '${data.employeeId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (emp.orgId !== currentUser.orgId) {
      const err = new Error('Access denied: Employee belongs to another organization.');
      err.statusCode = 403;
      throw err;
    }

    // Safety Guard 1: Prevent terminating self
    if (emp.userId && emp.userId === currentUser.id) {
      const err = new Error('Self-termination violation: You cannot terminate your own employee account.');
      err.statusCode = 403;
      throw err;
    }

    // Safety Guard 2: Prevent non-SuperAdmin from terminating SuperAdmin / OrgAdmin / Primary Admin
    if (emp.userId) {
      const targetUser = await userRepository.findById(emp.userId);
      if (targetUser) {
        const targetRole = (targetUser.roleName || '').toLowerCase();
        const isTargetAdmin = ['superadmin', 'orgadmin', 'admin'].includes(targetRole);
        const isCurrentSuper = ['superadmin'].includes((currentUser.roleName || '').toLowerCase());
        if (isTargetAdmin && !isCurrentSuper) {
          const err = new Error('Permission denied: Executive and System Administrator accounts can only be terminated by SuperAdmin.');
          err.statusCode = 403;
          throw err;
        }
      }
    }

    // Safety Guard 3: Prevent terminating already exited / terminated employees
    if (emp.status === 'Terminated' || emp.status === 'Exited') {
      const err = new Error(`Employee profile is already marked as '${emp.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const isImmediate = data.immediate === true || String(data.timeline).toUpperCase() === 'IMMEDIATE';
    const noticePeriodDays = isImmediate ? 0 : (data.noticePeriodDays !== undefined && data.noticePeriodDays !== null && data.noticePeriodDays !== '' ? parseInt(data.noticePeriodDays, 10) : 0);
    const effectiveDate = data.effectiveDate || new Date().toISOString().split('T')[0];
    const exitType = (data.exitType || 'INVOLUNTARY').toUpperCase();
    const initialStatus = isImmediate ? 'EXIT_PROCESSING' : 'APPROVED';
    const currentStage = 'CLEARANCE_IN_PROGRESS';
    const reasonPrefix = data.terminationCategory ? `[${data.terminationCategory}] ` : '[INVOLUNTARY TERMINATION] ';
    const fullReason = `${reasonPrefix}${data.reason.trim()}`;

    // Check if there is already an active exit request
    const existing = await exitRepository.findByEmployeeId(emp.id, currentUser.orgId);
    let exitRequest;

    if (existing && ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'NOTICE_PERIOD', 'EXIT_PROCESSING'].includes(existing.status)) {
      exitRequest = await exitRepository.update(existing.id, {
        exitType,
        reason: fullReason,
        noticePeriodDays,
        requestedLastWorkingDay: effectiveDate,
        approvedLastWorkingDay: effectiveDate,
        status: initialStatus,
        currentStage,
        reviewedBy: currentUser.id,
        approvedBy: currentUser.id,
        managerFeedback: `Company termination initiated by ${currentUser.email || 'HR'}. Grounds: ${data.terminationCategory || 'Company Decision'}`,
        managerReviewedAt: new Date().toISOString(),
        hrReviewedAt: new Date().toISOString(),
        hrComments: data.comments || data.hrNotes || 'Company initiated involuntary separation.',
      });
    } else {
      exitRequest = await exitRepository.create({
        orgId: currentUser.orgId,
        employeeId: emp.id,
        resignationDate: new Date().toISOString().split('T')[0],
        noticePeriodDays,
        requestedLastWorkingDay: effectiveDate,
        approvedLastWorkingDay: effectiveDate,
        exitType,
        reason: fullReason,
        comments: data.comments || data.hrNotes || 'Company initiated involuntary separation.',
        status: initialStatus,
        currentStage,
        submittedBy: currentUser.id,
      });

      // Update approved_by and hr fields
      exitRequest = await exitRepository.update(exitRequest.id, {
        approvedBy: currentUser.id,
        hrReviewedAt: new Date().toISOString(),
        hrComments: data.comments || data.hrNotes || 'Company initiated involuntary separation.',
      });
    }

    // Update Employee Status
    const newEmpStatus = isImmediate ? 'Terminated' : 'Notice Period';
    await employeeRepository.update(emp.id, { status: newEmpStatus });

    // Initialize or update employee_offboardings
    await exitRepository.upsertOffboarding({
      orgId: currentUser.orgId,
      exitRequestId: exitRequest.id,
      employeeId: emp.id,
      lastWorkingDay: effectiveDate,
      offboardingStatus: 'CLEARANCES_PENDING',
      clearanceStatus: 'PENDING',
      accessRemovalStatus: 'ACTIVE',
      assetStatus: 'PENDING',
      hrCompletionStatus: 'IN_PROGRESS',
      processedBy: currentUser.id,
      notes: `Termination initiated by ${currentUser.email || 'HR'}. Category: ${data.terminationCategory || 'Company Decision'}`,
    });

    // Auto-provision clearance tasks if none exist yet
    const existingClearances = await exitRepository.findClearancesByRequestId(exitRequest.id);
    if (!existingClearances || existingClearances.length === 0) {
      const defaultTasks = [
        {
          orgId: currentUser.orgId,
          exitRequestId: exitRequest.id,
          employeeId: emp.id,
          checklistCategory: 'ASSETS_RETURNED',
          departmentScope: 'IT',
          taskTitle: 'Immediate Laptop, Mobile & Hardware Asset Handover',
          description: 'Physical inspection and recovery of company issued hardware and accessories.',
        },
        {
          orgId: currentUser.orgId,
          exitRequestId: exitRequest.id,
          employeeId: emp.id,
          checklistCategory: 'IT_ACCESS',
          departmentScope: 'IT',
          taskTitle: 'SSO, Cloud, VPN & Email Access Deprovisioning',
          description: 'Immediate revocation of privileged company credentials, Google Workspace / Microsoft 365, and VPN access.',
        },
        {
          orgId: currentUser.orgId,
          exitRequestId: exitRequest.id,
          employeeId: emp.id,
          checklistCategory: 'GENERAL',
          departmentScope: 'ADMIN',
          taskTitle: 'Building Access Card & ID Badge Surrender',
          description: 'Surrender of facility entry cards, biometric access, and parking decals.',
        },
        {
          orgId: currentUser.orgId,
          exitRequestId: exitRequest.id,
          employeeId: emp.id,
          checklistCategory: 'FINANCE_PAYROLL',
          departmentScope: 'FINANCE',
          taskTitle: 'Corporate Card, Expense Claims & Severance Verification',
          description: 'Reconciliation of corporate card expenses, pending claims, and severance calculation.',
        },
        {
          orgId: currentUser.orgId,
          exitRequestId: exitRequest.id,
          employeeId: emp.id,
          checklistCategory: 'HR_CLEARANCE',
          departmentScope: 'HR',
          taskTitle: 'Termination Documentation & Separation Agreement Sign-Off',
          description: 'Issuance of formal termination notice, release agreement, and severance breakdown.',
        },
      ];
      await exitRepository.createClearanceBatch(defaultTasks);
    }

    // Record approval workflow instance / action
    try {
      const wfId = exitRequest.id.startsWith('exit-') ? `wf-${exitRequest.id}` : `wf-exit-${exitRequest.id}`;
      const existingWf = await workflowRepository.findByEntity('EXIT_REQUEST', exitRequest.id);
      if (!existingWf) {
        await workflowRepository.createWorkflowInstance(
          {
            id: wfId,
            orgId: currentUser.orgId,
            entityType: 'EXIT_REQUEST',
            entityId: exitRequest.id,
            workflowType: 'COMPANY_TERMINATION',
            currentStage: currentStage,
            currentStatus: initialStatus,
            requesterId: emp.id,
            managerId: emp.managerId || null,
          },
          {
            stage: 'HR_REVIEW',
            actorUserId: currentUser.id,
            actorRole: currentUser.roleName || 'HR',
            action: 'APPROVE',
            fromStatus: 'ACTIVE',
            toStatus: initialStatus,
            comments: `Company termination initiated. Grounds: ${data.terminationCategory || 'Company Decision'}`,
          }
        );
      } else {
        await workflowRepository.recordAction(existingWf.id, {
          stage: 'HR_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'HR',
          action: 'APPROVE',
          fromStatus: existingWf.currentStatus,
          toStatus: initialStatus,
          nextStage: currentStage,
          comments: `Company termination initiated. Grounds: ${data.terminationCategory || 'Company Decision'}`,
        });
      }
    } catch (wfError) {
      logger.warn('ExitService', `Approval workflow tracking notice during termination ${exitRequest.id}: ${wfError.message}`);
    }

    // Severance package recording if specified
    if (data.severanceAmount !== undefined && data.severanceAmount !== null && data.severanceAmount !== '') {
      const severance = parseFloat(data.severanceAmount);
      if (!isNaN(severance) && severance > 0) {
        await exitRepository.saveFnfSettlement({
          orgId: currentUser.orgId,
          exitRequestId: exitRequest.id,
          employeeId: emp.id,
          settlementDate: new Date().toISOString().split('T')[0],
          lastWorkingDay: effectiveDate,
          otherAllowances: severance,
          grossPayable: severance,
          netSettlementAmount: severance,
          paymentStatus: 'DRAFT',
          approvalStatus: 'PENDING',
          notes: `Severance package granted upon involuntary termination: ₹${severance.toLocaleString()}`,
        });
      }
    }

    // If immediate system access revocation requested
    if (data.revokeAccessImmediately && emp.userId) {
      try {
        await this.removeAccess(currentUser, exitRequest.id, {
          reassignManagerId: data.reassignManagerId || null,
          comments: `Immediate credentials revocation upon company termination: ${data.reason.trim()}`,
        });
      } catch (revErr) {
        logger.warn('ExitService', `Could not immediately revoke access: ${revErr.message}`);
      }
    }

    // Notify employee of termination / separation notice
    if (emp.userId) {
      await notificationService
        .notifyTerminationInitiated({
          orgId: currentUser.orgId,
          exitId: exitRequest.id,
          employeeUserId: emp.userId,
          effectiveDate,
          terminationType: exitType,
        })
        .catch((e) => logger.warn('ExitService', `Notification error: ${e.message}`));
    }

    return this.getExitById(currentUser, exitRequest.id);
  },
};
