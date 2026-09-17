import { performanceRepository } from '../repositories/performanceRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { notificationService } from './notificationService.js';
import { validateEmployeeId } from '../validators/managerValidator.js';
import { logger } from '../utils/logger.js';

export const performanceService = {
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

  // =========================================================================
  // 1. Performance Periods
  // =========================================================================

  async createPeriod(currentUser, periodData) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Forbidden: Only HR or Admins can create performance review periods.');
      err.statusCode = 403;
      throw err;
    }

    const id = `perf-prd-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const created = await performanceRepository.createPeriod({
      ...periodData,
      id,
      orgId: currentUser.orgId,
    });

    logger.info('PerformanceService', `Created review period ${created.code} for org ${currentUser.orgId}`);
    return created;
  },

  async getPeriods(currentUser, filters = {}) {
    return performanceRepository.findPeriods(currentUser.orgId, filters);
  },

  async getPeriodById(currentUser, periodId) {
    const period = await performanceRepository.findPeriodById(periodId, currentUser.orgId);
    if (!period) {
      const err = new Error('Performance period not found.');
      err.statusCode = 404;
      throw err;
    }
    return period;
  },

  async updatePeriod(currentUser, periodId, updates = {}) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Forbidden: Only HR or Admins can update performance review periods.');
      err.statusCode = 403;
      throw err;
    }

    const period = await this.getPeriodById(currentUser, periodId);
    return performanceRepository.updatePeriod(period.id, currentUser.orgId, updates);
  },

  // =========================================================================
  // 2. Performance Records (Appraisals & Reviews)
  // =========================================================================

  async createRecord(currentUser, data, goals = []) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    // If employeeId is not provided, default to the caller's employee profile
    if (!data.employeeId && emp) {
      data.employeeId = emp.id;
    }

    // If regular employee, they can only create self-review for their own employee record
    if (!isHrAdmin && (!emp || emp.id !== data.employeeId)) {
      const err = new Error('Forbidden: Employees can only create their own performance self-evaluations.');
      err.statusCode = 403;
      throw err;
    }

    const idErr = validateEmployeeId(data.employeeId);
    if (idErr) {
      const err = new Error(idErr);
      err.statusCode = 400;
      throw err;
    }

    if (data.reviewerId) {
      const revErr = validateEmployeeId(data.reviewerId);
      if (revErr) {
        const err = new Error(`Reviewer ID error: ${revErr}`);
        err.statusCode = 400;
        throw err;
      }
    }

    // Duplicate submission prevention
    const existing = await performanceRepository.findRecordByEmployeeAndPeriod(data.employeeId, data.reviewPeriod);
    if (existing) {
      const err = new Error(`Duplicate submission error: A performance appraisal record already exists for employee '${data.employeeId}' in period '${data.reviewPeriod}'.`);
      err.statusCode = 409;
      throw err;
    }

    // Verify employee exists
    const targetEmp = await employeeRepository.findById(data.employeeId);
    if (!targetEmp || targetEmp.orgId !== currentUser.orgId) {
      const err = new Error('Target employee not found in your organization.');
      err.statusCode = 404;
      throw err;
    }

    const id = `perf-rec-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const recordNumber = `REV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const reviewerId = data.reviewerId || targetEmp.managerId || null;

    const record = await performanceRepository.createRecord(
      {
        id,
        recordNumber,
        orgId: currentUser.orgId,
        employeeId: data.employeeId,
        reviewerId,
        reviewerUserId: data.reviewerUserId || null,
        periodId: data.periodId || null,
        reviewPeriod: data.reviewPeriod,
        status: data.status || 'DRAFT',
        approvalState: 'PENDING',
        rating: data.rating || null,
        score: data.score || null,
        feedback: data.feedback || '',
        selfComments: data.selfComments || '',
        reviewerComments: data.reviewerComments || '',
        reviewDate: data.reviewDate || new Date().toISOString().split('T')[0],
        actorUserId: currentUser.id,
      },
      goals
    );

    // Initialize approval workflow tracking instance
    await workflowRepository.createWorkflowInstance(
      {
        orgId: currentUser.orgId,
        entityType: 'PERFORMANCE_REVIEW',
        entityId: record.id,
        workflowType: 'EMPLOYEE_MANAGER_HR',
        currentStage: 'EMPLOYEE_SUBMISSION',
        currentStatus: 'PENDING',
        requesterId: data.employeeId,
        managerId: reviewerId,
      },
      {
        stage: 'EMPLOYEE_SUBMISSION',
        actorUserId: currentUser.id,
        actorRole: currentUser.roleName || 'Employee',
        action: 'SUBMIT',
        fromStatus: 'PENDING',
        toStatus: 'PENDING',
        comments: 'Performance appraisal draft initiated.',
      }
    );

    return record;
  },

  async getRecords(currentUser, filters = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    // If regular employee (not manager, not HR), restrict strictly to own records
    if (!isHrAdmin) {
      const isManager = (currentUser.roleName || '').toLowerCase() === 'manager';
      if (!isManager) {
        if (!emp) return [];
        filters.employeeId = emp.id;
      } else {
        // Manager can see direct reports or own records
        if (!filters.employeeId && emp) {
          filters.reviewerId = emp.id;
        }
      }
    }

    return performanceRepository.findRecords(currentUser.orgId, filters);
  },

  async getMyRecords(currentUser) {
    const emp = await this.resolveEmployee(currentUser);
    if (!emp) return [];
    return performanceRepository.findRecords(currentUser.orgId, { employeeId: emp.id });
  },

  async getTeamRecords(currentUser) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    if (isHrAdmin) {
      return performanceRepository.findRecords(currentUser.orgId);
    }

    const emp = await this.resolveEmployee(currentUser);
    if (!emp) return [];

    return performanceRepository.findTeamRecords(currentUser.orgId, emp.id);
  },

  async getRecordById(currentUser, recordId) {
    const record = await performanceRepository.findRecordById(recordId, currentUser.orgId);
    if (!record) {
      const err = new Error('Performance record not found.');
      err.statusCode = 404;
      throw err;
    }

    // IDOR check: HR/Admin can view any; Manager can view direct reports; Employee can view own
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    if (!isHrAdmin) {
      const emp = await this.resolveEmployee(currentUser);
      const isOwn = emp && emp.id === record.employeeId;

      const targetEmp = await employeeRepository.findById(record.employeeId);
      const isDirectManager = emp && targetEmp && targetEmp.managerId === emp.id;
      const isReviewer = emp && (emp.id === record.reviewerId || record.reviewerUserId === currentUser.id);

      if (!isOwn && !isDirectManager && !isReviewer) {
        const err = new Error('Access Forbidden: You do not have permission to view this performance review.');
        err.statusCode = 403;
        throw err;
      }
    }

    return record;
  },

  async updateDraftRecord(currentUser, recordId, updates = {}) {
    const record = await this.getRecordById(currentUser, recordId);

    // Only allow editing draft/returned reviews
    if (!['DRAFT', 'RETURNED'].includes(record.status)) {
      const err = new Error(`Cannot modify review in status '${record.status}'. Only DRAFT or RETURNED appraisals can be edited.`);
      err.statusCode = 400;
      throw err;
    }

    return performanceRepository.updateRecord(record.id, currentUser.orgId, updates);
  },

  /**
   * 3. Lifecycle Stage: Employee submits appraisal to Manager
   */
  async submitRecord(currentUser, recordId, { comments = '' } = {}) {
    const record = await this.getRecordById(currentUser, recordId);

    if (!['DRAFT', 'RETURNED'].includes(record.status)) {
      const err = new Error(`Invalid status transition: Cannot submit appraisal from status '${record.status}'. Appraisal must be in 'DRAFT' or 'RETURNED' status.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await performanceRepository.updateStatus(record.id, currentUser.orgId, 'SUBMITTED', {
      approvalState: 'IN_REVIEW',
      actorUserId: currentUser.id,
      comments: comments || 'Appraisal submitted for manager review.',
    });

    // Advance workflow state machine
    try {
      const wf = await workflowRepository.findByEntity('PERFORMANCE_REVIEW', record.id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: 'EMPLOYEE_SUBMISSION',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'Employee',
          action: 'SUBMIT_REVIEW',
          fromStatus: record.status,
          toStatus: 'SUBMITTED',
          nextStage: 'MANAGER_REVIEW',
          comments: comments || 'Employee submitted self-evaluation.',
        });
      }
    } catch (e) {
      logger.warn('PerformanceService', `Failed to advance workflow audit: ${e.message}`);
    }

    // Trigger in-app notification to Manager
    if (record.reviewer) {
      const reviewerEmp = await employeeRepository.findById(record.reviewerId);
      if (reviewerEmp && reviewerEmp.userId) {
        await notificationService.createSystemNotification({
          orgId: currentUser.orgId,
          userId: reviewerEmp.userId,
          eventType: 'GENERAL_ALERT',
          title: 'Performance Review Awaiting Your Evaluation',
          message: `${record.employee?.fullName || 'An employee'} has submitted their performance self-review for ${record.reviewPeriod}.`,
          entityType: 'PERFORMANCE_REVIEW',
          entityId: record.id,
          actionUrl: `/performance/${record.id}`,
        });
      }
    }

    return updated;
  },

  /**
   * 4. Lifecycle Stage: Manager evaluates, adds ratings & comments, forwards to HR
   */
  async managerReview(currentUser, recordId, reviewData = {}) {
    const record = await this.getRecordById(currentUser, recordId);
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    // Self-approval / self-review prevention
    if (emp && emp.id === record.employeeId && !isHrAdmin) {
      const err = new Error('Self-approval violation: You cannot perform manager evaluation or review your own appraisal.');
      err.statusCode = 403;
      throw err;
    }

    // Manager scope authorization
    const targetEmp = await employeeRepository.findById(record.employeeId);
    const isDirectManager = emp && targetEmp && targetEmp.managerId === emp.id;
    const isAuthorizedReviewer = isHrAdmin || isDirectManager || (emp && (emp.id === record.reviewerId || record.reviewerUserId === currentUser.id));
    
    if (!isAuthorizedReviewer) {
      const err = new Error('Forbidden: You are not authorized to review performance appraisals for this employee.');
      err.statusCode = 403;
      throw err;
    }

    // State transition validation
    if (!['SUBMITTED', 'PENDING'].includes(record.status)) {
      const err = new Error(`Invalid status transition: Cannot submit manager review on appraisal with status '${record.status}'. Appraisal must be in 'SUBMITTED' status.`);
      err.statusCode = 400;
      throw err;
    }

    // Rating validation
    if (reviewData.rating === undefined || reviewData.rating === null) {
      const err = new Error('Manager rating is required (between 1.00 and 5.00).');
      err.statusCode = 400;
      throw err;
    }
    const r = parseFloat(reviewData.rating);
    if (isNaN(r) || r < 1.0 || r > 5.0) {
      const err = new Error('Rating must be a numeric score between 1.00 and 5.00.');
      err.statusCode = 400;
      throw err;
    }

    const updated = await performanceRepository.updateStatus(record.id, currentUser.orgId, 'UNDER_REVIEW', {
      approvalState: 'IN_REVIEW',
      rating: r,
      score: reviewData.score !== undefined ? parseFloat(reviewData.score) : record.score,
      reviewerComments: reviewData.reviewerComments || '',
      feedback: reviewData.feedback || '',
      actorUserId: currentUser.id,
      comments: reviewData.comments || 'Manager evaluation submitted for HR sign-off.',
    });

    // Advance workflow state to HR_REVIEW
    try {
      const wf = await workflowRepository.findByEntity('PERFORMANCE_REVIEW', record.id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: 'MANAGER_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'Manager',
          action: 'SUBMIT_REVIEW',
          fromStatus: 'SUBMITTED',
          toStatus: 'UNDER_REVIEW',
          nextStage: 'HR_REVIEW',
          comments: reviewData.comments || 'Manager completed rating and evaluation.',
        });
      }
    } catch (e) {
      logger.warn('PerformanceService', `Failed to advance workflow audit: ${e.message}`);
    }

    return updated;
  },

  /**
   * 5. Lifecycle Stage: HR / Admin approves appraisal
   */
  async hrApprove(currentUser, recordId, { comments = '' } = {}) {
    if (!this.isHrOrAdmin(currentUser)) {
      const err = new Error('Forbidden: Only HR or Admins can finalize and approve performance appraisals.');
      err.statusCode = 403;
      throw err;
    }

    const record = await this.getRecordById(currentUser, recordId);
    const emp = await this.resolveEmployee(currentUser);

    // Self-approval prevention
    if (emp && emp.id === record.employeeId) {
      const err = new Error('Self-approval violation: You cannot approve your own performance appraisal.');
      err.statusCode = 403;
      throw err;
    }

    // State transition validation: must be UNDER_REVIEW
    if (record.status !== 'UNDER_REVIEW') {
      const err = new Error(`Invalid status transition: Cannot approve appraisal in status '${record.status}'. Appraisal must be in 'UNDER_REVIEW' status.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await performanceRepository.updateStatus(record.id, currentUser.orgId, 'APPROVED', {
      approvalState: 'APPROVED',
      actorUserId: currentUser.id,
      comments: comments || 'Appraisal approved and completed by HR.',
    });

    // Complete workflow state
    try {
      const wf = await workflowRepository.findByEntity('PERFORMANCE_REVIEW', record.id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: 'HR_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'HR',
          action: 'APPROVE',
          fromStatus: record.status,
          toStatus: 'APPROVED',
          nextStage: 'COMPLETED',
          hrUserId: currentUser.id,
          comments: comments || 'HR sign-off granted.',
        });
      }
    } catch (e) {
      logger.warn('PerformanceService', `Failed to advance workflow audit: ${e.message}`);
    }

    // Notify employee of completed appraisal
    if (record.employee?.userId) {
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: record.employee.userId,
        eventType: 'GENERAL_ALERT',
        title: 'Performance Review Approved',
        message: `Your performance review for ${record.reviewPeriod} has been approved by HR. Final Rating: ${updated.rating || 'N/A'}/5.0`,
        entityType: 'PERFORMANCE_REVIEW',
        entityId: record.id,
        actionUrl: `/performance/${record.id}`,
      });
    }

    return updated;
  },

  /**
   * 6. Lifecycle Stage: Return review back to employee for revision
   */
  async returnRecord(currentUser, recordId, { reason = '', rejectionReason = '', comments = '' } = {}) {
    const record = await this.getRecordById(currentUser, recordId);
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    const targetEmp = await employeeRepository.findById(record.employeeId);
    const isDirectManager = emp && targetEmp && targetEmp.managerId === emp.id;
    const isAuthorized = isHrAdmin || isDirectManager || (emp && (emp.id === record.reviewerId || record.reviewerUserId === currentUser.id));

    if (!isAuthorized) {
      const err = new Error('Forbidden: You are not authorized to return this performance review.');
      err.statusCode = 403;
      throw err;
    }

    const finalReason = (reason || rejectionReason || comments || '').trim();
    if (!finalReason) {
      const err = new Error('A reason is required when returning an appraisal for revision.');
      err.statusCode = 400;
      throw err;
    }

    if (!['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(record.status)) {
      const err = new Error(`Invalid status transition: Cannot return appraisal in status '${record.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await performanceRepository.updateStatus(record.id, currentUser.orgId, 'RETURNED', {
      approvalState: 'RETURNED',
      rejectionReason: finalReason,
      actorUserId: currentUser.id,
      comments: `Returned for revision: ${finalReason}`,
    });

    // Record action in workflow
    try {
      const wf = await workflowRepository.findByEntity('PERFORMANCE_REVIEW', record.id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: wf.current_stage || 'MANAGER_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'Reviewer',
          action: 'RETURN',
          fromStatus: record.status,
          toStatus: 'RETURNED',
          nextStage: 'EMPLOYEE_SUBMISSION',
          comments: finalReason,
        });
      }
    } catch (e) {
      logger.warn('PerformanceService', `Failed to advance workflow audit: ${e.message}`);
    }

    // Notify employee of returned appraisal
    if (record.employee?.userId) {
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: record.employee.userId,
        eventType: 'GENERAL_ALERT',
        title: 'Performance Review Returned for Revision',
        message: `Your review for ${record.reviewPeriod} was returned: "${finalReason}". Please revise and resubmit.`,
        entityType: 'PERFORMANCE_REVIEW',
        entityId: record.id,
        actionUrl: `/performance/${record.id}`,
      });
    }

    return updated;
  },

  /**
   * 7. Lifecycle Stage: Reject review
   */
  async rejectRecord(currentUser, recordId, { reason = '', rejectionReason = '', comments = '' } = {}) {
    const record = await this.getRecordById(currentUser, recordId);
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const emp = await this.resolveEmployee(currentUser);

    const targetEmp = await employeeRepository.findById(record.employeeId);
    const isDirectManager = emp && targetEmp && targetEmp.managerId === emp.id;
    const isAuthorized = isHrAdmin || isDirectManager || (emp && (emp.id === record.reviewerId || record.reviewerUserId === currentUser.id));

    if (!isAuthorized) {
      const err = new Error('Forbidden: You are not authorized to reject this performance review.');
      err.statusCode = 403;
      throw err;
    }

    const finalReason = (rejectionReason || reason || comments || '').trim();
    if (!finalReason) {
      const err = new Error('A rejection reason is required when rejecting an appraisal.');
      err.statusCode = 400;
      throw err;
    }

    if (!['SUBMITTED', 'UNDER_REVIEW', 'PENDING'].includes(record.status)) {
      const err = new Error(`Invalid status transition: Cannot reject appraisal in status '${record.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    const updated = await performanceRepository.updateStatus(record.id, currentUser.orgId, 'REJECTED', {
      approvalState: 'REJECTED',
      rejectionReason: finalReason,
      actorUserId: currentUser.id,
      comments: `Appraisal rejected: ${finalReason}`,
    });

    // Record action in workflow
    try {
      const wf = await workflowRepository.findByEntity('PERFORMANCE_REVIEW', record.id);
      if (wf) {
        await workflowRepository.recordAction(wf.id, {
          stage: wf.current_stage || 'HR_REVIEW',
          actorUserId: currentUser.id,
          actorRole: currentUser.roleName || 'Reviewer',
          action: 'REJECT',
          fromStatus: record.status,
          toStatus: 'REJECTED',
          nextStage: 'REJECTED',
          comments: reason,
        });
      }
    } catch (e) {
      logger.warn('PerformanceService', `Failed to advance workflow audit: ${e.message}`);
    }

    // Notify employee of rejected appraisal
    if (record.employee?.userId) {
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: record.employee.userId,
        eventType: 'GENERAL_ALERT',
        title: 'Performance Review Rejected',
        message: `Your review for ${record.reviewPeriod} was rejected: "${reason}".`,
        entityType: 'PERFORMANCE_REVIEW',
        entityId: record.id,
        actionUrl: `/performance/${record.id}`,
      });
    }

    return updated;
  },

  async getRecordHistory(currentUser, recordId) {
    await this.getRecordById(currentUser, recordId);
    return performanceRepository.getWorkflowHistory(recordId);
  },

  // =========================================================================
  // 3. Goal Management
  // =========================================================================

  async addGoal(currentUser, recordId, goalData) {
    const record = await this.getRecordById(currentUser, recordId);

    if (!['DRAFT', 'RETURNED'].includes(record.status)) {
      const err = new Error(`Cannot add goals to review in status '${record.status}'.`);
      err.statusCode = 400;
      throw err;
    }

    return performanceRepository.addGoal(record.id, record.employeeId, goalData);
  },

  async updateGoal(currentUser, goalId, goalData) {
    return performanceRepository.updateGoal(goalId, goalData);
  },

  async deleteGoal(currentUser, goalId) {
    return performanceRepository.deleteGoal(goalId);
  },
};

export default performanceService;
