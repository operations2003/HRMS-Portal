import { exitRepository } from '../repositories/exitRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
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
    return employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
  },

  // =========================================================================
  // 1. Employee Resignation Submission
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
    if (existing && ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED'].includes(existing.status)) {
      const err = new Error(
        `You already have an active exit request (${existing.id}) currently in status '${existing.status}'.`
      );
      err.statusCode = 409;
      throw err;
    }

    const noticePeriodDays = data.noticePeriodDays !== undefined ? parseInt(data.noticePeriodDays, 10) : 30;

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
      status: 'SUBMITTED',
      currentStage: 'MANAGER_REVIEW',
      documentId: data.documentId || null,
    });

    // Initialize approval workflow
    const wfId = `wf-exit-${exitRequest.id}`;
    await workflowRepository.createWorkflowInstance(
      {
        id: wfId,
        orgId: currentUser.orgId,
        entityType: 'EXIT_REQUEST',
        entityId: exitRequest.id,
        workflowType: 'EMPLOYEE_MANAGER_HR',
        currentStage: 'MANAGER_REVIEW',
        currentStatus: 'SUBMITTED',
        requesterId: emp.id,
        managerId: emp.managerId || null,
      },
      {
        stage: 'EMPLOYEE_SUBMISSION',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'Employee',
        action: 'SUBMIT',
        fromStatus: 'ACTIVE',
        toStatus: 'SUBMITTED',
        comments: data.reason.trim(),
      }
    );

    // Notify assigned manager if exists
    if (emp.managerId) {
      const mgr = await employeeRepository.findById(emp.managerId);
      if (mgr && mgr.userId) {
        await notificationService.createSystemNotification({
          orgId: currentUser.orgId,
          userId: mgr.userId,
          eventType: 'RESIGNATION_SUBMITTED',
          title: 'Team Resignation Submitted',
          message: `${emp.firstName} ${emp.lastName} has submitted their resignation. Please review.`,
          entityType: 'EXIT_REQUEST',
          entityId: exitRequest.id,
          actionUrl: `/exit/${exitRequest.id}`,
        });
      }
    }

    return exitRequest;
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

    const clearances = await exitRepository.findClearancesByRequestId(exitRequest.id);
    const fnf = await exitRepository.findFnfByRequestId(exitRequest.id);
    const audit = await workflowRepository.getAuditLog('EXIT_REQUEST', exitRequest.id);

    return {
      ...exitRequest,
      clearances,
      fnf,
      workflowAudit: audit,
    };
  },

  async getTeamExits(currentUser, query = {}) {
    const emp = await this.resolveEmployee(currentUser);
    if (!emp && !this.isHrOrAdmin(currentUser)) {
      return { items: [], total: 0, limit: 20, offset: 0 };
    }

    return exitRepository.findAll({
      orgId: currentUser.orgId,
      managerId: emp ? emp.id : null,
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
    const isSuperAdmin = (currentUser.roleName || '').toLowerCase() === 'superadmin';
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

    const clearances = await exitRepository.findClearancesByRequestId(exit.id);
    const fnf = await exitRepository.findFnfByRequestId(exit.id);
    const audit = await workflowRepository.getAuditLog('EXIT_REQUEST', exit.id);

    return {
      ...exit,
      clearances,
      fnf,
      workflowAudit: audit,
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

    const updated = await exitRepository.update(id, {
      status: 'UNDER_REVIEW',
      currentStage: 'HR_REVIEW',
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

    return updated;
  },

  // =========================================================================
  // 4. HR Exit Approval & Notice Period Initiation
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

    // Stage validation
    if (exit.currentStage !== 'HR_REVIEW' && exit.status !== 'UNDER_REVIEW') {
      const err = new Error(`Invalid transition: Exit request is currently in '${exit.currentStage}' stage.`);
      err.statusCode = 400;
      throw err;
    }

    const approvedLwd = approvalData.approvedLastWorkingDay;
    const noticeDays = approvalData.noticePeriodDays !== undefined ? parseInt(approvalData.noticePeriodDays, 10) : exit.noticePeriodDays;

    const updated = await exitRepository.update(id, {
      status: 'APPROVED',
      currentStage: 'CLEARANCE_IN_PROGRESS',
      approvedLastWorkingDay: approvedLwd,
      noticePeriodDays: noticeDays,
      hrReviewedAt: new Date().toISOString(),
      hrComments: approvalData.hrComments || 'HR approved resignation and initialized clearance tasks.',
    });

    // Transition employee profile to Notice Period
    await employeeRepository.update(exit.employeeId, { status: 'Notice Period' });

    // Auto-provision standard departmental clearance checklists
    const defaultTasks = [
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        departmentScope: 'IT',
        taskTitle: 'Laptop, Monitor & Hardware Asset Handover',
        description: 'Physical inspection and recovery of company issued hardware.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        departmentScope: 'IT',
        taskTitle: 'VPN, Cloud & Email Account Revocation Review',
        description: 'Audit of active single sign-on (SSO) and privileged credentials.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        departmentScope: 'FINANCE',
        taskTitle: 'Corporate Credit Card & Travel Advance Settlement',
        description: 'Verification of pending travel expenses, corporate cards, and advances.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        departmentScope: 'ADMIN',
        taskTitle: 'Building Access Keycard & Physical ID Badge Return',
        description: 'Recovery of security badges, parking permits, and facility keys.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        departmentScope: 'MANAGER',
        taskTitle: 'Project Knowledge Transfer & Code Repository Sign-Off',
        description: 'Complete KT handover to designated team members and documentation update.',
      },
      {
        orgId: currentUser.orgId,
        exitRequestId: id,
        employeeId: exit.employeeId,
        departmentScope: 'HR',
        taskTitle: 'Exit Interview & Benefits Termination Guidance',
        description: 'Formal exit interview, insurance continuation options, and PF/gratuity guidance.',
      },
    ];

    await exitRepository.createClearanceBatch(defaultTasks);

    // Advance approval workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', id);
    if (wf) {
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
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: exitingEmp.userId,
        eventType: 'EXIT_APPROVED',
        title: 'Resignation Approved - Notice Period Active',
        message: `Your resignation has been approved. Your approved last working day is ${approvedLwd}. Departmental clearance tasks are now active.`,
        entityType: 'EXIT_REQUEST',
        entityId: id,
        actionUrl: `/exit/${id}`,
      });
    }

    return updated;
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

    return exitRepository.findClearancesByRequestId(exitRequestId);
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

    const updatedTask = await exitRepository.updateClearanceTask(taskId, {
      status: updateData.status.toUpperCase(),
      clearedBy: currentUser.id,
      remarks: updateData.remarks || '',
      recoveryAmount: updateData.recoveryAmount ? parseFloat(updateData.recoveryAmount) : 0.0,
    });

    // Check if all clearances are complete
    const allDone = await exitRepository.areAllClearancesComplete(task.exitRequestId);
    if (allDone) {
      await exitRepository.update(task.exitRequestId, { currentStage: 'FNF_PENDING' });
    }

    return updatedTask;
  },

  // =========================================================================
  // 6. Full & Final (F&F) Settlement Calculation & Processing
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
    const monthlySalary = emp.salary || 0.0;
    const dailyRate = Math.round((monthlySalary / 30.0) * 100) / 100;

    // Calculate payable days (default 30 or days remaining in month)
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
    const noticePeriodRecovery = options.noticePeriodRecovery ? parseFloat(options.noticePeriodRecovery) : 0.0;
    const assetRecoveryDeduction = options.assetRecoveryDeduction ? parseFloat(options.assetRecoveryDeduction) : clearanceRecovery;
    const taxDeduction = options.taxDeduction ? parseFloat(options.taxDeduction) : 0.0;

    // Net settlement calculation
    const grossAdditions = salaryPayable + leaveEncashmentAmount + bonusGratuity;
    const totalDeductions = noticePeriodRecovery + assetRecoveryDeduction + taxDeduction;
    const netSettlementAmount = Math.max(0, Math.round((grossAdditions - totalDeductions) * 100) / 100);

    const fnf = await exitRepository.saveFnfSettlement({
      orgId: currentUser.orgId,
      exitRequestId,
      employeeId: exit.employeeId,
      settlementDate: options.settlementDate || new Date().toISOString().split('T')[0],
      payableDays,
      salaryPayable,
      leaveEncashmentDays: encashmentDays,
      leaveEncashmentAmount,
      bonusGratuity,
      noticePeriodRecovery,
      assetRecoveryDeduction,
      taxDeduction,
      netSettlementAmount,
      paymentStatus: options.paymentStatus || 'APPROVED',
      approvedBy: currentUser.id,
      notes: options.notes || 'Full and final settlement computed successfully.',
    });

    return fnf;
  },

  // =========================================================================
  // 7. Access Deprovisioning & Exit Finalization
  // =========================================================================

  async deprovisionAccess(currentUser, exitRequestId, deprovisionData = {}) {
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

    const prevEmpStatus = emp.status;
    let prevUserStatus = 'Active';
    if (emp.userId) {
      const userRec = await userRepository.findById(emp.userId);
      if (userRec) prevUserStatus = userRec.status;
      // 1. Deactivate Portal User Account (Immediately invalidates login & active sessions)
      await userRepository.update(emp.userId, { status: 'Inactive' });
    }

    // 2. Mark Employee Profile as Exited
    await employeeRepository.update(emp.id, { status: 'Exited' });

    // 3. Mark Exit Request as Completed
    await exitRepository.update(exitRequestId, {
      status: 'COMPLETED',
      currentStage: 'COMPLETED',
    });

    // 4. Update/Upsert employee_offboardings table record
    await pool.query(
      `INSERT INTO employee_offboardings (
        id, org_id, exit_request_id, employee_id, last_working_day,
        offboarding_status, clearance_status, access_removal_status, asset_status,
        hr_completion_status, completed_date, completed_at, processed_by, notes
      ) VALUES ($1, $2, $3, $4, $5, 'COMPLETED', 'CLEARED', 'DEPROVISIONED', 'RETURNED', 'COMPLETED', CURRENT_DATE, NOW(), $6, $7)
      ON CONFLICT (exit_request_id) DO UPDATE SET
        offboarding_status = 'COMPLETED',
        clearance_status = 'CLEARED',
        access_removal_status = 'DEPROVISIONED',
        asset_status = 'RETURNED',
        hr_completion_status = 'COMPLETED',
        completed_date = CURRENT_DATE,
        completed_at = NOW(),
        processed_by = EXCLUDED.processed_by,
        notes = EXCLUDED.notes,
        updated_at = NOW();`,
      [
        `offb-${exitRequestId}`,
        currentUser.orgId,
        exitRequestId,
        emp.id,
        exit.approvedLastWorkingDay || exit.requestedLastWorkingDay,
        currentUser.id,
        deprovisionData.comments || 'Deprovisioning finalized and all system access revoked.',
      ]
    );

    // 5. If Exiting Employee is a Manager, Reassign Direct Reports
    const interimManagerId = deprovisionData.reassignManagerId || null;
    await pool.query(
      `UPDATE employees SET manager_id = $1 WHERE manager_id = $2 AND org_id = $3;`,
      [interimManagerId, emp.id, currentUser.orgId]
    );

    // 6. Record in access_deprovisioning_audits table
    if (emp.userId) {
      const auditId = `aud-deprov-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await pool.query(
        `INSERT INTO access_deprovisioning_audits (
          id, org_id, exit_request_id, employee_id, user_id, actor_user_id,
          actor_role, action, previous_user_status, new_user_status,
          previous_employee_status, new_employee_status, reassigned_manager_id, reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'DEPROVISION_ACCESS', $8, 'Inactive', $9, 'Exited', $10, $11);`,
        [
          auditId,
          currentUser.orgId,
          exitRequestId,
          emp.id,
          emp.userId,
          currentUser.id,
          currentUser.roleName || 'HR',
          prevUserStatus || 'Active',
          prevEmpStatus || 'Notice Period',
          interimManagerId,
          deprovisionData.comments || 'System access deprovisioned, direct reports reassigned, exit completed.',
        ]
      );
    }

    // 7. Finalize Approval Workflow
    const wf = await workflowRepository.findByEntity('EXIT_REQUEST', exitRequestId);
    if (wf) {
      await workflowRepository.recordAction(wf.id, {
        stage: 'HR_REVIEW',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'HR',
        action: 'DEPROVISION',
        fromStatus: 'APPROVED',
        toStatus: 'COMPLETED',
        nextStage: 'COMPLETED',
        comments: deprovisionData.comments || 'System access deprovisioned, direct reports reassigned, exit completed.',
      });
    }

    // 8. Notify Exiting Employee
    if (emp.userId) {
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: emp.userId,
        eventType: 'DEPROVISIONING_EXECUTED',
        title: 'Exit Completed & Access Deprovisioned',
        message: 'Your offboarding process and Full & Final settlement have been successfully finalized.',
        entityType: 'EXIT_REQUEST',
        entityId: exitRequestId,
      });
    }

    return {
      message: 'Employee deprovisioning and exit completed successfully.',
      employeeId: emp.id,
      userId: emp.userId,
      accountStatus: 'Inactive',
      employmentStatus: 'Exited',
      exitStatus: 'COMPLETED',
    };
  },
};

