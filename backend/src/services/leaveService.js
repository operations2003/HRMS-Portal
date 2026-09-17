import { leaveRepository } from '../repositories/leaveRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { logger } from '../utils/logger.js';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Resolves the employee profile corresponding to an authenticated user
 */
const resolveRequesterEmployee = async (user) => {
  if (!user || !user.id) return null;

  let emp = await employeeRepository.findByUserId(user.id, user.orgId);
  if (emp) return emp;

  if (user.email) {
    emp = await employeeRepository.findByEmail(user.email, user.orgId);
    if (emp) return emp;
  }

  if (user.email && (user.id === 'user-superadmin-shubham' || normalizeRole(user.roleName) === 'superadmin')) {
    emp = await employeeRepository.findByEmail(user.email);
    if (emp) return emp;
  }

  return null;
};

/**
 * Safely parses YYYY-MM-DD string into a local Date at midnight
 */
const parseLocalDate = (dateStr) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const parts = dateStr.trim().split('-');
  if (parts.length !== 3) return null;
  const [y, m, d] = parts.map(Number);
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  const date = new Date(y, m - 1, d);
  // Verify date didn't overflow (e.g. Feb 30 becomes Mar 2)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
};

/**
 * Formats a Date object to YYYY-MM-DD string
 */
const formatLocalDate = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/**
 * Core calculation engine for Leave Duration
 * Excludes weekends (Sat/Sun) and active mandatory company/national holidays.
 */
const calculateLeaveDuration = async (orgId, startDateStr, endDateStr, isHalfDay = false, halfDayPeriod = null) => {
  const sDate = parseLocalDate(startDateStr);
  const eDate = parseLocalDate(endDateStr);

  if (!sDate || !eDate) {
    const error = new Error('Invalid calendar date provided. Expected valid YYYY-MM-DD format.');
    error.statusCode = 400;
    throw error;
  }

  if (sDate > eDate) {
    const error = new Error('Start date cannot be after end date.');
    error.statusCode = 400;
    throw error;
  }

  if (isHalfDay) {
    if (startDateStr.trim() !== endDateStr.trim()) {
      const error = new Error('Half-day leave must start and end on the same calendar date.');
      error.statusCode = 400;
      throw error;
    }
    const normPeriod = (halfDayPeriod || '').toUpperCase();
    if (!['FIRST_HALF', 'SECOND_HALF'].includes(normPeriod)) {
      const error = new Error('Half-day leave must specify halfDayPeriod as either FIRST_HALF or SECOND_HALF.');
      error.statusCode = 400;
      throw error;
    }
  }

  // Fetch active official holidays in date range for this organization
  const holidays = await leaveRepository.findActiveHolidaysBetween(orgId, startDateStr.trim(), endDateStr.trim());
  const holidayMap = new Map();
  for (const h of holidays) {
    holidayMap.set(h.holiday_date, h);
  }

  let totalCalendarDays = 0;
  let weekendDaysCount = 0;
  let holidayDaysCount = 0;
  let workingDaysCount = 0;
  const holidaysEncountered = [];

  const cur = new Date(sDate.getTime());
  while (cur <= eDate) {
    totalCalendarDays++;
    const curStr = formatLocalDate(cur);
    const dayOfWeek = cur.getDay(); // 0 = Sun, 6 = Sat

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayMap.has(curStr);

    if (isWeekend) {
      weekendDaysCount++;
      if (isHoliday) {
        holidaysEncountered.push({
          date: curStr,
          name: holidayMap.get(curStr).name,
          type: holidayMap.get(curStr).holiday_type,
          fallsOnWeekend: true,
        });
      }
    } else if (isHoliday) {
      holidayDaysCount++;
      holidaysEncountered.push({
        date: curStr,
        name: holidayMap.get(curStr).name,
        type: holidayMap.get(curStr).holiday_type,
        fallsOnWeekend: false,
      });
    } else {
      workingDaysCount++;
    }

    cur.setDate(cur.getDate() + 1);
  }

  if (isHalfDay) {
    if (weekendDaysCount > 0) {
      const error = new Error('Cannot apply for half-day leave on a weekend.');
      error.statusCode = 400;
      throw error;
    }
    if (holidayDaysCount > 0) {
      const error = new Error('Cannot apply for half-day leave on an official public holiday.');
      error.statusCode = 400;
      throw error;
    }
    return {
      startDate: startDateStr.trim(),
      endDate: endDateStr.trim(),
      isHalfDay: true,
      halfDayPeriod,
      totalCalendarDays: 1,
      weekendDays: 0,
      holidayDays: 0,
      workingDays: 0.5,
      totalDays: 0.5,
      holidays: [],
    };
  }

  if (workingDaysCount === 0) {
    const error = new Error('The requested leave period contains no working days (all days are weekends or official public holidays).');
    error.statusCode = 400;
    throw error;
  }

  return {
    startDate: startDateStr.trim(),
    endDate: endDateStr.trim(),
    isHalfDay: false,
    halfDayPeriod: null,
    totalCalendarDays,
    weekendDays: weekendDaysCount,
    holidayDays: holidayDaysCount,
    workingDays: workingDaysCount,
    totalDays: workingDaysCount,
    holidays: holidaysEncountered,
  };
};

export const leaveService = {
  /**
   * Preview calculated leave duration (working days, weekends, holidays)
   */
  async calculateDuration(user, data) {
    if (!data.startDate || !data.endDate) {
      const error = new Error('Both startDate and endDate are required.');
      error.statusCode = 400;
      throw error;
    }

    const emp = await resolveRequesterEmployee(user);
    const orgId = emp?.orgId || user.orgId || 'org-1';

    return calculateLeaveDuration(
      orgId,
      data.startDate,
      data.endDate,
      Boolean(data.isHalfDay),
      data.halfDayPeriod
    );
  },

  /**
   * Get active leave types for organization
   */
  async getLeaveTypes(user) {
    const emp = await resolveRequesterEmployee(user);
    const orgId = emp?.orgId || user?.orgId || 'org-1';
    let types = await leaveRepository.findLeaveTypes(orgId);
    if (!types || types.length === 0) {
      types = await leaveRepository.findLeaveTypes('org-1');
    }
    return types;
  },

  /**
   * Get leave balances for the authenticated employee
   */
  async getMyBalances(user, year = new Date().getFullYear()) {
    const emp = await resolveRequesterEmployee(user);
    if (!emp) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    let balances = await leaveRepository.getLeaveBalances(emp.id, year);
    if (balances.length === 0) {
      balances = await leaveRepository.initializeBalancesForEmployee(emp.id, emp.orgId, year);
    }
    return balances;
  },

  /**
   * Apply for Leave (Employee)
   */
  async applyLeave(user, data) {
    const emp = await resolveRequesterEmployee(user);
    if (!emp) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    // Inactive employee check
    if (emp.status && emp.status.toLowerCase() !== 'active') {
      const error = new Error(`Cannot apply for leave: Employee account status is "${emp.status}". Only active employees can apply for leave.`);
      error.statusCode = 403;
      throw error;
    }

    // Verify leave type exists and belongs to employee's organization
    const leaveType = await leaveRepository.findLeaveTypeById(data.leaveTypeId, emp.orgId);
    if (!leaveType) {
      const error = new Error('Selected leave type does not exist or is not available for your organization.');
      error.statusCode = 400;
      throw error;
    }

    const startDate = data.startDate.trim();
    const endDate = data.endDate.trim();
    const isHalfDay = Boolean(data.isHalfDay);
    const halfDayPeriod = isHalfDay ? data.halfDayPeriod : null;

    // Calculate duration with holiday, weekend and date validation
    const calculation = await calculateLeaveDuration(
      emp.orgId,
      startDate,
      endDate,
      isHalfDay,
      halfDayPeriod
    );
    const totalDays = calculation.totalDays;

    // Overlap validation
    const overlap = await leaveRepository.checkOverlappingLeave(emp.id, startDate, endDate, isHalfDay, halfDayPeriod);
    if (overlap) {
      const error = new Error(`Overlapping leave conflict: You already have an active ${overlap.status} leave request from ${overlap.start_date} to ${overlap.end_date}.`);
      error.statusCode = 409;
      throw error;
    }

    // Balance check
    const startYear = new Date(startDate).getFullYear();
    let balances = await leaveRepository.getLeaveBalances(emp.id, startYear);
    if (balances.length === 0) {
      balances = await leaveRepository.initializeBalancesForEmployee(emp.id, emp.orgId, startYear);
    }
    const balance = balances.find((b) => b.leaveTypeId === leaveType.id);

    // If leave type is paid and quota-tracked, verify available days
    if (balance && leaveType.isPaid && leaveType.daysPerYear > 0) {
      if (balance.remainingDays < totalDays) {
        const error = new Error(`Insufficient leave balance. You have ${balance.remainingDays} days remaining for ${leaveType.name}, but requested ${totalDays} days.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Create the leave request
    const request = await leaveRepository.createLeaveRequest({
      orgId: emp.orgId,
      employeeId: emp.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      isHalfDay,
      halfDayPeriod,
      totalDays,
      reason: data.reason,
    });

    // Update pending balance
    if (balance) {
      await leaveRepository.adjustBalance(emp.id, leaveType.id, startYear, { pendingDelta: totalDays });
    }

    // Initialize Phase 6 approval workflow tracking instance
    try {
      await workflowRepository.createWorkflowInstance(
        {
          orgId: emp.orgId,
          entityType: 'LEAVE_REQUEST',
          entityId: request.id,
          workflowType: 'EMPLOYEE_MANAGER_HR',
          currentStage: 'MANAGER_REVIEW',
          currentStatus: 'PENDING',
          requesterId: emp.id,
          managerId: emp.managerId || null,
        },
        {
          stage: 'EMPLOYEE_SUBMISSION',
          actorUserId: user.id,
          actorRole: user.roleName || 'Employee',
          action: 'SUBMIT',
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          comments: data.reason || 'Leave request submitted.',
        }
      );
    } catch (wfErr) {
      logger.warn('LeaveService', `Failed to initialize workflow instance for leave ${request.id}: ${wfErr.message}`);
    }

    return request;
  },

  /**
   * Get employee's own leave requests
   */
  async getMyLeaves(user, query = {}) {
    const emp = await resolveRequesterEmployee(user);
    if (!emp) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    return leaveRepository.findByEmployee(emp.id, emp.orgId, query);
  },

  /**
   * Get single leave request details (with IDOR protection)
   */
  async getById(user, id) {
    const record = await leaveRepository.findById(id);
    if (!record) {
      const error = new Error('Leave request not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);

    // Organization boundary check
    if (normRole !== 'superadmin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Leave request belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // HR & Admin have full organization visibility
    if (normRole === 'admin' || normRole === 'superadmin' || normRole === 'hr' || normRole === 'hrmanager') {
      return record;
    }

    const requesterEmp = await resolveRequesterEmployee(user);
    if (!requesterEmp) {
      const error = new Error('Access denied: No employee profile found for requester.');
      error.statusCode = 403;
      throw error;
    }

    // Requester owns the record
    if (record.employeeId === requesterEmp.id) {
      return record;
    }

    // Manager can view if employee is in manager's department
    if (normRole === 'manager') {
      if (requesterEmp.deptId && record.employee && record.employee.deptId === requesterEmp.deptId) {
        return record;
      }
      const error = new Error('Access denied: You can only view leave requests for members in your department.');
      error.statusCode = 403;
      throw error;
    }

    // Standard employee is blocked from other employees' records
    const error = new Error("Access denied: You are not authorized to view another employee's leave request.");
    error.statusCode = 403;
    throw error;
  },

  /**
   * Cancel Leave (Employee cancels own pending leave)
   */
  async cancelLeave(user, id, data = {}) {
    const record = await leaveRepository.findById(id);
    if (!record) {
      const error = new Error('Leave request not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);
    const requesterEmp = await resolveRequesterEmployee(user);

    // Permission check: only record owner (or HR/Admin) can cancel
    const isOwner = requesterEmp && record.employeeId === requesterEmp.id;
    const isHrOrAdmin = normRole === 'admin' || normRole === 'superadmin' || normRole === 'hr' || normRole === 'hrmanager';

    if (!isOwner && !isHrOrAdmin) {
      const error = new Error('Access denied: You can only cancel your own leave requests.');
      error.statusCode = 403;
      throw error;
    }

    // State validation
    if (record.status === 'CANCELLED') {
      const error = new Error('Leave request is already cancelled.');
      error.statusCode = 400;
      throw error;
    }

    if (record.status === 'REJECTED') {
      const error = new Error('Cannot cancel a leave request that has already been rejected.');
      error.statusCode = 400;
      throw error;
    }

    // If already approved, only future leave dates can be cancelled
    if (record.status === 'APPROVED') {
      const today = new Date().toISOString().split('T')[0];
      if (record.startDate < today) {
        const error = new Error('Cannot cancel an approved leave that has already started or completed.');
        error.statusCode = 400;
        throw error;
      }
    }

    const previousStatus = record.status;

    // Update status to CANCELLED
    const updated = await leaveRepository.updateStatus(id, {
      status: 'CANCELLED',
      cancellationReason: data.cancellationReason || 'Cancelled by employee',
      cancelledAt: new Date(),
    });

    // Revert balances
    const year = new Date(record.startDate).getFullYear();
    if (previousStatus === 'PENDING') {
      await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, { pendingDelta: -record.totalDays });
    } else if (previousStatus === 'APPROVED') {
      await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, { usedDelta: -record.totalDays });
    }

    return updated;
  },

  /**
   * Get team leaves for Manager (scoped to manager's department)
   */
  async getTeamLeaves(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    let deptId = query.deptId || null;

    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      if (!managerEmp || !managerEmp.deptId) {
        return {
          records: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      }
      deptId = managerEmp.deptId;
    }

    return leaveRepository.findTeamLeaves(deptId, user.orgId, query);
  },

  /**
   * Get organization-wide leaves for HR & Admin
   */
  async getOrgLeaves(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    if (normRole !== 'admin' && normRole !== 'superadmin' && normRole !== 'hr' && normRole !== 'hrmanager') {
      const error = new Error('Access denied: Requires HR or Admin authorization.');
      error.statusCode = 403;
      throw error;
    }

    return leaveRepository.findAllOrgLeaves(user.orgId, query);
  },

  /**
   * Approve Leave (Manager / HR / Admin)
   */
  async approveLeave(user, id, options = {}) {
    const record = await leaveRepository.findById(id);
    if (!record) {
      const error = new Error('Leave request not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);

    // Standard employee CANNOT approve leave
    if (normRole === 'employee') {
      const error = new Error('Access denied: Standard employees are not permitted to approve leave requests.');
      error.statusCode = 403;
      throw error;
    }

    const approverEmp = await resolveRequesterEmployee(user);

    // SELF-APPROVAL PREVENTION: Nobody can approve their own leave
    if ((approverEmp && record.employeeId === approverEmp.id) || (record.employee && record.employee.userId === user.id)) {
      const error = new Error('Self-approval violation: You cannot approve your own leave request.');
      error.statusCode = 403;
      throw error;
    }

    // Organization boundary check
    if (normRole !== 'superadmin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Leave request belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Manager scope check: can only approve within own department or direct team
    if (normRole === 'manager') {
      const isDirectReport = approverEmp && record.employee && record.employee.managerId === approverEmp.id;
      const isDeptMatch = approverEmp && approverEmp.deptId && record.employee && record.employee.deptId === approverEmp.deptId;
      if (!isDirectReport && !isDeptMatch) {
        const error = new Error('Access denied: Managers can only approve leave requests for employees in their team or department.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Must be in PENDING status
    if (record.status !== 'PENDING') {
      const error = new Error(`Cannot approve leave request: Current status is "${record.status}". Only PENDING requests can be approved.`);
      error.statusCode = 400;
      throw error;
    }

    // Transition status to APPROVED
    const updated = await leaveRepository.updateStatus(id, {
      status: 'APPROVED',
      approverId: approverEmp?.id || null,
      approverUserId: user.id,
    });

    // Move pending balance to used balance
    const year = new Date(record.startDate).getFullYear();
    await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, {
      pendingDelta: -record.totalDays,
      usedDelta: record.totalDays,
    });

    // Advance workflow state machine if tracking instance exists and not bypassed by workflow engine
    if (!options.skipWorkflowSync) {
      try {
        const wf = await workflowRepository.findByEntity('LEAVE_REQUEST', id);
        if (wf && wf.currentStatus !== 'APPROVED') {
          await workflowRepository.recordAction(wf.id, {
            stage: wf.currentStage || 'MANAGER_REVIEW',
            actorUserId: user.id,
            actorRole: user.roleName || 'Approver',
            action: 'APPROVE',
            fromStatus: 'PENDING',
            toStatus: 'APPROVED',
            nextStage: 'COMPLETED',
            comments: options.comments || 'Leave request approved.',
          });
        }
      } catch (wfErr) {
        logger.warn('LeaveService', `Failed to advance workflow audit for leave ${id}: ${wfErr.message}`);
      }
    }

    return updated;
  },

  /**
   * Reject Leave (Manager / HR / Admin)
   */
  async rejectLeave(user, id, data = {}) {
    const record = await leaveRepository.findById(id);
    if (!record) {
      const error = new Error('Leave request not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName);

    // Standard employee CANNOT reject leave
    if (normRole === 'employee') {
      const error = new Error('Access denied: Standard employees are not permitted to reject leave requests.');
      error.statusCode = 403;
      throw error;
    }

    const approverEmp = await resolveRequesterEmployee(user);

    // Self-rejection check
    if ((approverEmp && record.employeeId === approverEmp.id) || (record.employee && record.employee.userId === user.id)) {
      const error = new Error('Self-action violation: You cannot reject your own leave request.');
      error.statusCode = 403;
      throw error;
    }

    // Organization boundary check
    if (normRole !== 'superadmin' && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Leave request belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Manager scope check: can only reject within own department or direct team
    if (normRole === 'manager') {
      const isDirectReport = approverEmp && record.employee && record.employee.managerId === approverEmp.id;
      const isDeptMatch = approverEmp && approverEmp.deptId && record.employee && record.employee.deptId === approverEmp.deptId;
      if (!isDirectReport && !isDeptMatch) {
        const error = new Error('Access denied: Managers can only reject leave requests for employees in their team or department.');
        error.statusCode = 403;
        throw error;
      }
    }

    // Must be in PENDING status
    if (record.status !== 'PENDING') {
      const error = new Error(`Cannot reject leave request: Current status is "${record.status}". Only PENDING requests can be rejected.`);
      error.statusCode = 400;
      throw error;
    }

    // Rejection reason is required
    const rejectionReason = (data.rejectionReason || data.reason || data.comments || '').trim();
    if (!rejectionReason) {
      const error = new Error('Rejection reason is required to reject a leave request.');
      error.statusCode = 400;
      throw error;
    }

    // Transition status to REJECTED
    const updated = await leaveRepository.updateStatus(id, {
      status: 'REJECTED',
      approverId: approverEmp?.id || null,
      approverUserId: user.id,
      rejectionReason,
    });

    // Release pending balance
    const year = new Date(record.startDate).getFullYear();
    await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, {
      pendingDelta: -record.totalDays,
    });

    // Advance workflow state machine if tracking instance exists and not bypassed by workflow engine
    if (!data.skipWorkflowSync) {
      try {
        const wf = await workflowRepository.findByEntity('LEAVE_REQUEST', id);
        if (wf && wf.currentStatus !== 'REJECTED') {
          await workflowRepository.recordAction(wf.id, {
            stage: wf.currentStage || 'MANAGER_REVIEW',
            actorUserId: user.id,
            actorRole: user.roleName || 'Approver',
            action: 'REJECT',
            fromStatus: 'PENDING',
            toStatus: 'REJECTED',
            nextStage: 'REJECTED',
            comments: rejectionReason,
          });
        }
      } catch (wfErr) {
        logger.warn('LeaveService', `Failed to advance workflow audit for leave ${id}: ${wfErr.message}`);
      }
    }

    return updated;
  },
};
