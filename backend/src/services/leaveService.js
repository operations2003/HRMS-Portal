import { leaveRepository } from '../repositories/leaveRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { notificationService } from './notificationService.js';
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

  if (user.email && (user.id === 'user-superadmin-shubham' || normalizeRole(user.roleName) === 'superadmin' || normalizeRole(user.roleName) === 'admin')) {
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
const calculateLeaveDuration = async (orgId, startDateStr, endDateStr, isHalfDay = false, halfDayPeriod = null, allowZeroWorkingDays = false) => {
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
      if (allowZeroWorkingDays) {
        return {
          startDate: startDateStr.trim(),
          endDate: endDateStr.trim(),
          isHalfDay: true,
          halfDayPeriod,
          totalCalendarDays: 1,
          weekendDays: 1,
          holidayDays: 0,
          workingDays: 0,
          totalDays: 0,
          holidays: [],
          isNonWorkingPeriod: true,
          warning: 'Cannot apply for half-day leave on a weekend (Saturday or Sunday). Weekends are non-working days.',
        };
      }
      const error = new Error('Cannot apply for half-day leave on a weekend (Saturday or Sunday).');
      error.statusCode = 400;
      throw error;
    }
    if (holidayDaysCount > 0) {
      if (allowZeroWorkingDays) {
        return {
          startDate: startDateStr.trim(),
          endDate: endDateStr.trim(),
          isHalfDay: true,
          halfDayPeriod,
          totalCalendarDays: 1,
          weekendDays: 0,
          holidayDays: 1,
          workingDays: 0,
          totalDays: 0,
          holidays: holidaysEncountered,
          isNonWorkingPeriod: true,
          warning: 'Cannot apply for half-day leave on an official public holiday.',
        };
      }
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
    if (allowZeroWorkingDays) {
      return {
        startDate: startDateStr.trim(),
        endDate: endDateStr.trim(),
        isHalfDay: false,
        halfDayPeriod: null,
        totalCalendarDays,
        weekendDays: weekendDaysCount,
        holidayDays: holidayDaysCount,
        workingDays: 0,
        totalDays: 0,
        holidays: holidaysEncountered,
        isNonWorkingPeriod: true,
        warning: 'The requested leave period contains no working days (all selected days are weekends or official public holidays). Standard leave only applies to working business days (Monday to Friday).',
      };
    }
    const error = new Error('The requested leave period contains no working days (all days are weekends or official public holidays). Please select a working business day (Monday to Friday).');
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

export const RESTRICTED_LEAVE_CODES = ['SBL', 'ML', 'PTL', 'AWOL', 'LOP', 'LWP'];
export const RESTRICTED_LEAVE_NAMES = [
  'sabbatical leave',
  'maternity leave',
  'paternity leave',
  'absent without leave(awol)',
  'absent without leave',
  'awol',
  'leave without pay (lop)',
  'leave without pay',
  'loss of pay',
];

export const isRestrictedLeaveType = (lt) => {
  if (!lt) return false;
  const code = String(lt.code || '').trim().toUpperCase();
  const name = String(lt.name || '').trim().toLowerCase();
  if (RESTRICTED_LEAVE_CODES.includes(code)) return true;
  return RESTRICTED_LEAVE_NAMES.some((rn) => name === rn || name.includes(rn));
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
      data.halfDayPeriod,
      true // allowZeroWorkingDays for preview calculation
    );
  },

  /**
   * Get active leave types for organization
   */
  async getLeaveTypes(user, options = {}) {
    const emp = await resolveRequesterEmployee(user);
    const orgId = emp?.orgId || user?.orgId || 'org-1';
    
    let gender = options.gender || null;
    if (!options.all && !gender) {
      gender = emp?.gender || null;
    }

    let types = await leaveRepository.findLeaveTypes(orgId, options.all ? null : gender);
    if (!types || types.length === 0) {
      types = await leaveRepository.findLeaveTypes('org-1', options.all ? null : gender);
    }

    const enriched = types.map((lt) => ({
      ...lt,
      isRestricted: isRestrictedLeaveType(lt),
    }));

    if (options.forSelf) {
      return enriched.filter((lt) => !lt.isRestricted);
    }

    return enriched;
  },

  /**
   * Create a new custom leave type (Admin / HR)
   */
  async createLeaveType(user, data) {
    if (!data.name || !data.name.trim()) {
      const error = new Error('Leave type name is required.');
      error.statusCode = 400;
      throw error;
    }
    const emp = await resolveRequesterEmployee(user);
    const orgId = emp?.orgId || user?.orgId || 'org-1';
    return leaveRepository.createLeaveType({
      ...data,
      orgId,
    });
  },

  /**
   * Get leave balances for the authenticated employee
   */
  async getMyBalances(user, year = new Date().getFullYear(), options = {}) {
    const emp = await resolveRequesterEmployee(user);
    if (!emp) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    let balances = await leaveRepository.getLeaveBalances(emp.id, year, emp.gender);
    const types = await leaveRepository.findLeaveTypes(emp.orgId, emp.gender);
    if (balances.length < types.length) {
      balances = await leaveRepository.initializeBalancesForEmployee(emp.id, emp.orgId, year, emp.gender);
    }

    const enriched = balances.map((b) => ({
      ...b,
      isRestricted: isRestrictedLeaveType({ code: b.leaveTypeCode, name: b.leaveTypeName }),
    }));

    if (options.all === true) {
      return enriched;
    }

    // By default, only return applicable leaves that the employee can apply for
    return enriched.filter((b) => !b.isRestricted);
  },

  /**
   * Apply for Leave (Employee or Manager on behalf of Direct Report)
   * Strictly enforces:
   * 1. Employees cannot self-apply restricted leaves (Sabbatical, Maternity, Paternity, AWOL, LOP).
   * 2. Managers can apply restricted leaves on behalf of direct reports.
   * 3. Managers CANNOT apply restricted leaves for themselves.
   * 4. Managers cannot apply leaves for employees outside their reporting hierarchy.
   */
  async applyLeave(user, data) {
    const callerEmp = await resolveRequesterEmployee(user);
    if (!callerEmp) {
      const error = new Error('No employee profile found for your user account.');
      error.statusCode = 404;
      throw error;
    }

    const roles = Array.isArray(user.roles) ? user.roles : [user.roleName || user.role];
    const isHrAdmin = roles.some((r) =>
      ['Admin', 'SuperAdmin', 'HR', 'HRManager', 'OrgAdmin'].includes(r)
    );

    // Determine target employee: if employeeId is provided and different, check reporting hierarchy
    const targetEmployeeId = data.employeeId && data.employeeId.trim() ? data.employeeId.trim() : callerEmp.id;
    const isSelf = targetEmployeeId === callerEmp.id;

    const normRole = (user.roleName || user.role || '').toLowerCase();
    const isAdminOrCeo = ['admin', 'superadmin', 'orgadmin'].some((r) => normRole.includes(r)) || (user.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';
    if (isSelf && isAdminOrCeo) {
      const error = new Error('Access denied: Company Administrators and executive CEOs do not apply for employee leave.');
      error.statusCode = 403;
      throw error;
    }

    let targetEmp = callerEmp;
    if (!isSelf) {
      targetEmp = await employeeRepository.findById(targetEmployeeId);
      if (!targetEmp) {
        const error = new Error(`Target employee with ID '${targetEmployeeId}' not found.`);
        error.statusCode = 404;
        throw error;
      }
      if (targetEmp.orgId !== callerEmp.orgId && !isHrAdmin) {
        const error = new Error('Access denied: Employee not found in your organization.');
        error.statusCode = 403;
        throw error;
      }

      // Hierarchy verification:
      // If caller is HR/Admin -> allowed across organization.
      // If caller is Manager -> target employee MUST report directly to caller!
      // If caller is regular Employee -> forbidden from applying for others.
      if (!isHrAdmin) {
        if (targetEmp.managerId !== callerEmp.id) {
          const error = new Error('Access denied: You can only apply leave on behalf of employees who directly report to you in your reporting hierarchy.');
          error.statusCode = 403;
          throw error;
        }
      }
    }

    // Inactive employee check
    if (targetEmp.status && targetEmp.status.toLowerCase() !== 'active') {
      const error = new Error(`Cannot apply for leave: Employee account status is "${targetEmp.status}". Only active employees can take leave.`);
      error.statusCode = 403;
      throw error;
    }

    // Verify leave type exists and belongs to employee's organization
    const leaveType = await leaveRepository.findLeaveTypeById(data.leaveTypeId, targetEmp.orgId);
    if (!leaveType) {
      const error = new Error('Selected leave type does not exist or is not available for this organization.');
      error.statusCode = 400;
      throw error;
    }

    // CRITICAL SECURITY ENFORCEMENT: RESTRICTED LEAVE TYPES
    // (Sabbatical Leave, Maternity Leave, Paternity Leave, AWOL, Leave Without Pay)
    if (isRestrictedLeaveType(leaveType)) {
      if (isSelf) {
        const error = new Error(
          `Restricted leave policy violation: Employees and managers cannot apply for '${leaveType.name}' for themselves. This leave must be applied by your reporting manager on your behalf.`
        );
        error.statusCode = 403;
        throw error;
      }
    }

    // Gender eligibility verification on targetEmp
    const empGender = String(targetEmp.gender || 'Male').trim().toUpperCase();
    const ltGender = String(leaveType.genderEligibility || 'ALL').trim().toUpperCase();
    if (ltGender === 'FEMALE' && empGender === 'MALE') {
      const error = new Error('Maternity leave is only applicable to female employees.');
      error.statusCode = 400;
      throw error;
    }
    if (ltGender === 'MALE' && empGender === 'FEMALE') {
      const error = new Error('Paternity leave is only applicable to male employees.');
      error.statusCode = 400;
      throw error;
    }

    const startDate = data.startDate.trim();
    const endDate = data.endDate.trim();
    const isHalfDay = Boolean(data.isHalfDay);
    const halfDayPeriod = isHalfDay ? data.halfDayPeriod : null;

    // Calculate duration with holiday, weekend and date validation
    const calculation = await calculateLeaveDuration(
      targetEmp.orgId,
      startDate,
      endDate,
      isHalfDay,
      halfDayPeriod
    );
    const totalDays = calculation.totalDays;

    // Overlap validation for targetEmp
    const overlap = await leaveRepository.checkOverlappingLeave(targetEmp.id, startDate, endDate, isHalfDay, halfDayPeriod);
    if (overlap) {
      const error = new Error(`Overlapping leave conflict: Employee already has an active ${overlap.status} leave request from ${overlap.start_date} to ${overlap.end_date}.`);
      error.statusCode = 409;
      throw error;
    }

    // Balance check for targetEmp
    const startYear = new Date(startDate).getFullYear();
    let balances = await leaveRepository.getLeaveBalances(targetEmp.id, startYear);
    if (balances.length === 0) {
      balances = await leaveRepository.initializeBalancesForEmployee(targetEmp.id, targetEmp.orgId, startYear);
    }
    const balance = balances.find((b) => b.leaveTypeId === leaveType.id);

    // If leave type is paid and quota-tracked, verify available days
    if (balance && leaveType.isPaid && leaveType.daysPerYear > 0) {
      if (balance.remainingDays < totalDays) {
        const error = new Error(`Insufficient leave balance. Employee has ${balance.remainingDays} days remaining for ${leaveType.name}, but requested ${totalDays} days.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // Create the leave request
    const request = await leaveRepository.createLeaveRequest({
      orgId: targetEmp.orgId,
      employeeId: targetEmp.id,
      leaveTypeId: leaveType.id,
      startDate,
      endDate,
      isHalfDay,
      halfDayPeriod,
      totalDays,
      reason: isSelf
        ? data.reason
        : `[Applied by Manager: ${callerEmp.firstName} ${callerEmp.lastName}] ${data.reason}`,
    });

    // Update pending balance
    if (balance) {
      await leaveRepository.adjustBalance(targetEmp.id, leaveType.id, startYear, { pendingDelta: totalDays });
    }

    // Initialize Phase 6 approval workflow tracking instance
    try {
      await workflowRepository.createWorkflowInstance(
        {
          orgId: targetEmp.orgId,
          entityType: 'LEAVE_REQUEST',
          entityId: request.id,
          workflowType: 'EMPLOYEE_MANAGER_HR',
          currentStage: 'MANAGER_REVIEW',
          currentStatus: 'PENDING',
          requesterId: targetEmp.id,
          managerId: targetEmp.managerId || null,
        },
        {
          stage: isSelf ? 'EMPLOYEE_SUBMISSION' : 'MANAGER_SUBMISSION',
          actorUserId: user.id,
          actorRole: user.roleName || (isSelf ? 'Employee' : 'Manager'),
          action: 'SUBMIT',
          fromStatus: 'PENDING',
          toStatus: 'PENDING',
          comments: data.reason || (isSelf ? 'Leave request submitted.' : `Leave applied by reporting manager on employee's behalf.`),
        }
      );
    } catch (wfErr) {
      logger.warn('LeaveService', `Failed to initialize workflow instance for leave ${request.id}: ${wfErr.message}`);
    }

    // Dispatch in-app notifications
    try {
      if (isSelf && targetEmp.managerId) {
        const mgrEmp = await employeeRepository.findById(targetEmp.managerId);
        if (mgrEmp && mgrEmp.userId) {
          await notificationService.notifyLeaveApprovalPending({
            orgId: targetEmp.orgId,
            leaveId: request.id,
            employeeName: `${targetEmp.firstName || ''} ${targetEmp.lastName || ''}`.trim(),
            startDate,
            endDate,
            managerUserId: mgrEmp.userId,
          });
        }
      } else if (!isSelf && targetEmp.userId) {
        await notificationService.createNotification({
          orgId: targetEmp.orgId,
          userId: targetEmp.userId,
          eventType: 'LEAVE_APPLIED_BY_MANAGER',
          title: `${leaveType.name} Applied by Manager`,
          message: `${callerEmp.firstName} ${callerEmp.lastName} has applied ${leaveType.name} on your behalf from ${startDate} to ${endDate}.`,
          entityType: 'LEAVE_REQUEST',
          entityId: request.id,
          actionUrl: '/leaves',
        });
      }
    } catch (notifErr) {
      logger.warn('LeaveService', `Failed to dispatch leave notification: ${notifErr.message}`);
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
    if (normRole !== 'superadmin' && normRole !== 'admin' && record.orgId !== user.orgId) {
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
   * Get team leaves for Manager or organization leaves for HR/Admin
   */
  async getTeamLeaves(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    let deptId = query.deptId || null;
    let managerId = null;

    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      if (!managerEmp) {
        return {
          records: [],
          pagination: { total: 0, page: 1, limit: 20, totalPages: 0 },
        };
      }
      deptId = query.deptId || null;
      managerId = managerEmp.id;
    }

    return leaveRepository.findTeamLeaves(deptId, user.orgId, { ...query, managerId });
  },

  /**
   * Get team leave KPI statistics for Manager / HR / Admin
   */
  async getTeamLeaveStats(user, query = {}) {
    const normRole = normalizeRole(user.roleName);
    let deptId = query.deptId || null;
    let managerId = null;

    if (normRole === 'manager') {
      const managerEmp = await resolveRequesterEmployee(user);
      if (!managerEmp) {
        return {
          pending: 0,
          approved: 0,
          rejected: 0,
          cancelled: 0,
          total: 0,
          onLeaveToday: 0,
        };
      }
      deptId = query.deptId || null;
      managerId = managerEmp.id;
    }

    return leaveRepository.getTeamLeaveStats(deptId, user.orgId, { managerId });
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

    const normRole = normalizeRole(user.roleName || user.role);

    // Approval is restricted to Admin, HR, and Manager roles only
    const isApproverRole = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin', 'manager', 'lead', 'teamlead', 'supervisor'].includes(normRole);
    if (!isApproverRole) {
      const error = new Error('Access denied: Only Admin, HR, and Manager roles are permitted to approve leave requests.');
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
    if (normRole !== 'superadmin' && normRole !== 'admin' && record.orgId !== user.orgId) {
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

    // Send in-app system notification to employee
    try {
      const emp = await employeeRepository.findById(record.employeeId);
      if (emp && emp.userId) {
        await notificationService.createSystemNotification({
          orgId: user.orgId,
          userId: emp.userId,
          eventType: 'LEAVE_APPROVED',
          title: 'Leave Request Approved',
          message: `Your leave request from ${record.startDate} to ${record.endDate} has been approved.${options.comments ? ` Comments: "${options.comments}"` : ''}`,
          entityType: 'LEAVE_REQUEST',
          entityId: record.id,
          actionUrl: '/leaves',
        });
      }
    } catch (notifErr) {
      logger.warn('LeaveService', `Failed to dispatch approval notification for leave ${id}: ${notifErr.message}`);
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

    const normRole = normalizeRole(user.roleName || user.role);

    // Rejection is restricted to Admin, HR, and Manager roles only
    const isApproverRole = ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin', 'manager', 'lead', 'teamlead', 'supervisor'].includes(normRole);
    if (!isApproverRole) {
      const error = new Error('Access denied: Only Admin, HR, and Manager roles are permitted to reject leave requests.');
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
    if (normRole !== 'superadmin' && normRole !== 'admin' && record.orgId !== user.orgId) {
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

    // Send in-app system notification to employee
    try {
      const emp = await employeeRepository.findById(record.employeeId);
      if (emp && emp.userId) {
        await notificationService.createSystemNotification({
          orgId: user.orgId,
          userId: emp.userId,
          eventType: 'LEAVE_REJECTED',
          title: 'Leave Request Rejected',
          message: `Your leave request from ${record.startDate} to ${record.endDate} has been rejected. Reason: "${rejectionReason}"`,
          entityType: 'LEAVE_REQUEST',
          entityId: record.id,
          actionUrl: '/leaves',
        });
      }
    } catch (notifErr) {
      logger.warn('LeaveService', `Failed to dispatch rejection notification for leave ${id}: ${notifErr.message}`);
    }

    return updated;
  },
};
