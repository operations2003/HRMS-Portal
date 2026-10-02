import { pool } from '../config/db.js';
import { leaveRepository } from '../repositories/leaveRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { workflowRepository } from '../repositories/workflowRepository.js';
import { notificationService } from './notificationService.js';
import { logger } from '../utils/logger.js';
import {
  isSpecialLeaveType,
  isRestrictedLeaveType,
  isUnpaidLeave,
  SPECIAL_LEAVE_CODES,
  SPECIAL_LEAVE_NAMES,
} from '../utils/leaveUtils.js';

export {
  isSpecialLeaveType,
  isRestrictedLeaveType,
  isUnpaidLeave,
  SPECIAL_LEAVE_CODES,
  SPECIAL_LEAVE_NAMES,
};

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
 * Excludes weekends (Sunday) and active mandatory company/national holidays (6 working days: Mon-Sat).
 */
const calculateLeaveDuration = async (
  orgId,
  startDateStr,
  endDateStr,
  isHalfDay = false,
  halfDayPeriod = null,
  allowZeroWorkingDays = false,
  isRestricted = false
) => {
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

    // 6 working days policy (Monday to Saturday): only Sunday (0) is a non-working weekend day
    const isWeekend = dayOfWeek === 0;
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
    if (isRestricted) {
      return {
        startDate: startDateStr.trim(),
        endDate: endDateStr.trim(),
        isHalfDay: true,
        halfDayPeriod,
        totalCalendarDays: 1,
        weekendDays: weekendDaysCount,
        holidayDays: holidayDaysCount,
        workingDays: 0.5,
        totalDays: 0.5,
        holidays: holidaysEncountered,
      };
    }
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
          warning: 'Cannot apply for half-day leave on a weekend (Sunday). Sundays are non-working days.',
        };
      }
      const error = new Error('Cannot apply for half-day leave on a weekend (Sunday).');
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

  // If this is a restricted leave assignment (Holiday, AWOL, LOP, Sabbatical, Maternity, Paternity)
  if (isRestricted) {
    const effDays = Math.max(1, totalCalendarDays - weekendDaysCount || totalCalendarDays);
    return {
      startDate: startDateStr.trim(),
      endDate: endDateStr.trim(),
      isHalfDay: false,
      halfDayPeriod: null,
      totalCalendarDays,
      weekendDays: weekendDaysCount,
      holidayDays: holidayDaysCount,
      workingDays: effDays,
      totalDays: effDays,
      holidays: holidaysEncountered,
      isNonWorkingPeriod: false,
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
        warning: 'The requested leave period contains no working days (all selected days are Sundays or official public holidays). Standard leave applies to working business days (Monday to Saturday).',
      };
    }
    const error = new Error('The requested leave period contains no working days (all days are Sundays or official public holidays). Please select a working business day (Monday to Saturday).');
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


/**
 * Synchronize approved/assigned leave dates to the attendance_records table
 */
export const syncLeaveToAttendance = async (
  targetEmp,
  request,
  leaveType,
  startDateStr,
  endDateStr,
  isHalfDay = false,
  halfDayPeriod = null,
  dateDecisions = null
) => {
  try {
    if (!targetEmp) return;

    const code = String(leaveType?.code || '').trim().toUpperCase();
    
    // For LWP/LOP, do not sync to attendance - these will be processed later as unpaid leave
    // Also clean up any existing attendance records for this leave period
    if (code === 'LOP' || code === 'LWP') {
      logger.info('LeaveService', `Cleaning up and skipping attendance sync for LWP/LOP leave type for employee ${targetEmp.id}`);
      
      // Remove any attendance records that may have been created for this LWP leave
      const sDate = parseLocalDate(startDateStr);
      const eDate = parseLocalDate(endDateStr);
      if (sDate && eDate) {
        await pool.query(
          `DELETE FROM attendance_records 
           WHERE employee_id = $1 
             AND attendance_date BETWEEN $2::date AND $3::date 
             AND source = 'LEAVE_ASSIGNMENT'
             AND notes ILIKE '%Leave Without Pay%'`,
          [targetEmp.id, startDateStr, endDateStr]
        );
      }
      
      return; // Don't create attendance records for unpaid leaves
    }
    
    // For LWP/LOP, do not sync to attendance - these will be processed later as unpaid leave
    if (code === 'LOP' || code === 'LWP') {
      logger.info('LeaveService', `Skipping attendance sync for LWP/LOP leave type for employee ${targetEmp.id}`);
      return; // Don't create attendance records for unpaid leaves
    }
    
    let attStatus = 'ON_LEAVE';
    if (code === 'HL') {
      attStatus = 'HOLIDAY';
    } else if (code === 'AWOL') {
      attStatus = 'ABSENT';
    } else if (isHalfDay) {
      attStatus = 'HALF_DAY';
    }

    const totalHours = isHalfDay ? 4.00 : 0.00;
    const notes = isHalfDay
      ? `${leaveType?.name || 'Leave'} (${halfDayPeriod === 'FIRST_HALF' ? 'Morning Half' : 'Afternoon Half'} - Approved)`
      : `${leaveType?.name || 'Leave'} (Approved)`;

    // Collect approved and rejected dates
    let approvedDates = [];
    let rejectedDates = [];

    if (Array.isArray(dateDecisions) && dateDecisions.length > 0) {
      for (const item of dateDecisions) {
        if (!item || !item.date) continue;
        const dStr = String(item.date).trim();
        const itemStatus = String(item.status || '').toUpperCase();
        if (itemStatus === 'APPROVED') {
          approvedDates.push({
            date: dStr,
            dayFraction: item.dayFraction || (isHalfDay ? 0.5 : 1.0),
          });
        } else if (itemStatus === 'REJECTED') {
          rejectedDates.push(dStr);
        }
      }
    } else {
      const sDate = parseLocalDate(startDateStr);
      const eDate = parseLocalDate(endDateStr);
      if (sDate && eDate) {
        const cur = new Date(sDate.getTime());
        while (cur <= eDate) {
          approvedDates.push({
            date: formatLocalDate(cur),
            dayFraction: isHalfDay ? 0.5 : 1.0,
          });
          cur.setDate(cur.getDate() + 1);
        }
      }
    }

    // 1. Clean up any previous attendance records for rejected dates
    for (const rejDate of rejectedDates) {
      await pool.query(
        `DELETE FROM attendance_records 
         WHERE employee_id = $1 AND attendance_date = $2::date AND source = 'LEAVE_ASSIGNMENT'`,
        [targetEmp.id, rejDate]
      );
    }

    // 2. Insert or update attendance records ONLY for approved dates
    for (const appItem of approvedDates) {
      const curStr = appItem.date;
      const recordId = `att-lve-${targetEmp.id}-${curStr}`;
      const itemHours = appItem.dayFraction === 0.5 ? 4.00 : totalHours;
      const itemStatus = appItem.dayFraction === 0.5 ? 'HALF_DAY' : attStatus;

      const sql = `
        INSERT INTO attendance_records (
          id, org_id, employee_id, attendance_date, timezone,
          total_hours, status, notes, source, updated_at
        ) VALUES (
          $1, $2, $3, $4::date, 'UTC',
          $5, $6, $7, 'LEAVE_ASSIGNMENT', NOW()
        )
        ON CONFLICT (employee_id, attendance_date)
        DO UPDATE SET
          status = EXCLUDED.status,
          total_hours = EXCLUDED.total_hours,
          notes = EXCLUDED.notes,
          source = EXCLUDED.source,
          updated_at = NOW();
      `;

      await pool.query(sql, [
        recordId,
        targetEmp.orgId,
        targetEmp.id,
        curStr,
        itemHours,
        itemStatus,
        notes,
      ]);
    }
  } catch (err) {
    logger.warn('LeaveService', `Failed to sync leave to attendance: ${err.message}`);
  }
};

export const leaveService = {
  /**
   * Preview calculated leave duration (working days, weekends, holidays)
   */
  async calculateDuration(user, data) {
    const emp = await resolveRequesterEmployee(user);
    const orgId = emp?.orgId || user.orgId || 'org-1';

    let isRestricted = false;
    if (data.leaveTypeId) {
      const lt = await leaveRepository.findLeaveTypeById(data.leaveTypeId, orgId);
      isRestricted = isRestrictedLeaveType(lt);
    }

    // If explicit dates array is provided (e.g. 5 Oct, 8 Oct, 12 Oct)
    if (Array.isArray(data.dates) && data.dates.length > 0) {
      const rawDates = data.dates
        .map((d) => String(d).trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      const uniqueDates = Array.from(new Set(rawDates)).sort();

      if (uniqueDates.length === 0) {
        const error = new Error('No valid dates provided.');
        error.statusCode = 400;
        throw error;
      }

      const sDateStr = uniqueDates[0];
      const eDateStr = uniqueDates[uniqueDates.length - 1];

      // Fetch holidays in span
      const holidays = await leaveRepository.findActiveHolidaysBetween(orgId, sDateStr, eDateStr);
      const holidayMap = new Map();
      for (const h of holidays) {
        holidayMap.set(h.holiday_date, h);
      }

      const isHalfDay = Boolean(data.isHalfDay);
      const dayFactor = isHalfDay ? 0.5 : 1.0;
      let workingDays = 0;
      let weekendDays = 0;
      let holidayDays = 0;
      const holidaysEncountered = [];
      const validDates = [];

      for (const dStr of uniqueDates) {
        const dObj = parseLocalDate(dStr);
        if (!dObj) continue;
        const isSunday = dObj.getDay() === 0;
        const holiday = holidayMap.get(dStr);

        if (isRestricted) {
          workingDays += dayFactor;
          validDates.push(dStr);
          if (holiday) {
            holidaysEncountered.push({
              date: dStr,
              name: holiday.name,
              type: holiday.holiday_type,
              fallsOnWeekend: isSunday,
            });
          }
        } else if (isSunday) {
          weekendDays++;
        } else if (holiday) {
          holidayDays++;
          holidaysEncountered.push({
            date: dStr,
            name: holiday.name,
            type: holiday.holiday_type,
            fallsOnWeekend: false,
          });
        } else {
          workingDays += dayFactor;
          validDates.push(dStr);
        }
      }

      return {
        startDate: sDateStr,
        endDate: eDateStr,
        isHalfDay,
        halfDayPeriod: isHalfDay ? data.halfDayPeriod : undefined,
        totalCalendarDays: uniqueDates.length,
        weekendDays,
        holidayDays,
        workingDays,
        totalDays: workingDays,
        holidays: holidaysEncountered,
        dates: uniqueDates,
        validDates,
      };
    }

    if (!data.startDate || !data.endDate) {
      const error = new Error('Both startDate and endDate are required.');
      error.statusCode = 400;
      throw error;
    }

    return calculateLeaveDuration(
      orgId,
      data.startDate,
      data.endDate,
      Boolean(data.isHalfDay),
      data.halfDayPeriod,
      true, // allowZeroWorkingDays for preview calculation
      isRestricted
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
    const allRoles = (Array.isArray(user.roles) ? user.roles : [user.roleName || user.role || ''])
      .filter(Boolean)
      .map((r) => String(r).toLowerCase());
    const isAdminOrCeo =
      allRoles.some((r) => ['admin', 'superadmin', 'orgadmin'].some((adm) => r.includes(adm))) ||
      (user.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';

    if (isAdminOrCeo) {
      return [];
    }

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
   * Apply / Assign Leave
   * Strictly enforces:
   * 1. Employees CANNOT self-apply restricted leaves (Holiday, AWOL, LOP, Sabbatical, Maternity, Paternity).
   * 2. Admin: Can assign restricted & standard leave types to ANY employee in the organization.
   * 3. HR: Can assign restricted & standard leave types to ALL employees in the organization.
   * 4. Manager: Can assign restricted & standard leave types ONLY to employees within their department/authorized reporting scope.
   * 5. Assigning leave records the exact dates, auto-approves, and reflects in leave history & attendance records.
   */
  async applyLeave(user, data) {
    const roles = Array.isArray(user.roles) ? user.roles : [user.roleName || user.role];
    const normRoles = roles.filter(Boolean).map((r) => normalizeRole(r));
    const isAdmin =
      normRoles.some((r) => ['admin', 'superadmin', 'orgadmin'].includes(r)) ||
      (user.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';
    const isHr = normRoles.some((r) => ['hr', 'hrmanager'].includes(r));
    const isManager = normRoles.some((r) => ['manager', 'lead', 'teamlead', 'supervisor'].includes(r));
    const isHrAdmin = isAdmin || isHr;

    let callerEmp = await resolveRequesterEmployee(user);
    if (!callerEmp) {
      if (!isHrAdmin || !data.employeeId) {
        const error = new Error('No employee profile found for your user account.');
        error.statusCode = 404;
        throw error;
      }
      callerEmp = {
        id: null,
        firstName: user.firstName || 'Admin',
        lastName: user.lastName || '',
        orgId: user.orgId || 'org-1',
      };
    }

    // Determine target employee: if employeeId is provided, check reporting hierarchy / admin scope
    const targetEmployeeId = data.employeeId && data.employeeId.trim() ? data.employeeId.trim() : (callerEmp.id || '');
    const isSelf = Boolean(callerEmp.id && targetEmployeeId === callerEmp.id);

    if (isSelf && isAdmin) {
      const error = new Error('Access denied: Company Administrators and executive CEOs do not apply for employee leave.');
      error.statusCode = 403;
      throw error;
    }

    let targetEmp = callerEmp;
    if (!isSelf) {
      if (!isHrAdmin && !isManager) {
        const error = new Error('Access denied: Only Admin, HR, and Managers can assign leave to employees.');
        error.statusCode = 403;
        throw error;
      }

      targetEmp = await employeeRepository.findById(targetEmployeeId);
      if (!targetEmp) {
        const error = new Error(`Target employee with ID '${targetEmployeeId}' not found.`);
        error.statusCode = 404;
        throw error;
      }
      if (callerEmp.id && targetEmp.orgId !== callerEmp.orgId && !isHrAdmin) {
        const error = new Error('Access denied: Employee not found in your organization.');
        error.statusCode = 403;
        throw error;
      }

      // Hierarchy verification:
      // If caller is HR/Admin -> allowed across entire organization.
      // If caller is Manager -> target employee MUST be in their department or directly report to them.
      if (isManager && !isHrAdmin) {
        const isDirectReport = callerEmp.id && targetEmp.managerId === callerEmp.id;
        const isSameDept = callerEmp.deptId && targetEmp.deptId && targetEmp.deptId === callerEmp.deptId;
        if (!isDirectReport && !isSameDept) {
          const error = new Error('Access denied: Managers can assign these leave types only to employees within their department or authorized reporting scope.');
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
    // (Holiday, AWOL, LOP, Maternity Leave, Sabbatical Leave, Paternity Leave)
    // Employees cannot self-apply for these restricted leave types.
    const isRestricted = isRestrictedLeaveType(leaveType);
    if (isRestricted) {
      if (isSelf) {
        const error = new Error(
          `Restricted leave policy violation: Employees cannot apply for '${leaveType.name}' for themselves. This leave must be assigned with exact dates by an authorized Manager, HR, or Admin.`
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

    const isHalfDay = Boolean(data.isHalfDay);
    const halfDayPeriod = isHalfDay ? data.halfDayPeriod : null;
    const dayFactor = isHalfDay ? 0.5 : 1.0;

    let startDate;
    let endDate;
    let totalDays;
    let dateDecisions = [];

    // Support explicit selected dates (e.g. 5 Oct, 8 Oct, 12 Oct)
    if (Array.isArray(data.dates) && data.dates.length > 0) {
      const rawDates = data.dates
        .map((d) => String(d).trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      const sortedDates = Array.from(new Set(rawDates)).sort();

      if (sortedDates.length === 0) {
        const error = new Error('No valid dates provided in the selected dates list.');
        error.statusCode = 400;
        throw error;
      }

      startDate = sortedDates[0];
      endDate = sortedDates[sortedDates.length - 1];

      // Fetch official holidays
      const holidays = await leaveRepository.findActiveHolidaysBetween(targetEmp.orgId, startDate, endDate);
      const holidaySet = new Set(holidays.map((h) => h.holiday_date));

      for (const dStr of sortedDates) {
        const dObj = parseLocalDate(dStr);
        if (!dObj) continue;
        const isSunday = dObj.getDay() === 0;
        const isHoliday = holidaySet.has(dStr);

        if (!isRestricted && (isSunday || isHoliday)) {
          // If employee specifically selected a Sunday or holiday on standard leave, warn or skip
          continue;
        }

        dateDecisions.push({
          date: dStr,
          status: 'PENDING',
          dayFraction: dayFactor,
          reason: '',
        });
      }

      if (dateDecisions.length === 0) {
        const error = new Error('None of the selected dates are working business days (Mon–Sat excluding holidays).');
        error.statusCode = 400;
        throw error;
      }

      totalDays = dateDecisions.length * dayFactor;
    } else {
      if (!data.startDate || !data.endDate) {
        const error = new Error('Start date and end date are required.');
        error.statusCode = 400;
        throw error;
      }

      startDate = data.startDate.trim();
      endDate = data.endDate.trim();

      // Calculate duration with holiday, weekend and date validation
      const calculation = await calculateLeaveDuration(
        targetEmp.orgId,
        startDate,
        endDate,
        isHalfDay,
        halfDayPeriod,
        false,
        isRestricted
      );
      totalDays = calculation.totalDays;

      // Expand date range into individual date decisions
      const holidays = await leaveRepository.findActiveHolidaysBetween(targetEmp.orgId, startDate, endDate);
      const holidaySet = new Set(holidays.map((h) => h.holiday_date));
      const sDate = parseLocalDate(startDate);
      const eDate = parseLocalDate(endDate);
      const cur = new Date(sDate.getTime());

      while (cur <= eDate) {
        const curStr = formatLocalDate(cur);
        const isSunday = cur.getDay() === 0;
        const isHoliday = holidaySet.has(curStr);

        if (isRestricted || (!isSunday && !isHoliday)) {
          dateDecisions.push({
            date: curStr,
            status: 'PENDING',
            dayFraction: dayFactor,
            reason: '',
          });
        }
        cur.setDate(cur.getDate() + 1);
      }

      if (dateDecisions.length === 0) {
        dateDecisions.push({
          date: startDate,
          status: 'PENDING',
          dayFraction: dayFactor,
          reason: '',
        });
      }
    }

    // Overlap validation for targetEmp
    const overlap = await leaveRepository.checkOverlappingLeave(targetEmp.id, startDate, endDate, isHalfDay, halfDayPeriod);
    if (overlap) {
      const error = new Error(`Overlapping leave conflict: Employee already has an active ${overlap.status} leave request from ${overlap.start_date} to ${overlap.end_date}.`);
      error.statusCode = 409;
      throw error;
    }

    const startYear = new Date(startDate).getFullYear();

    // ENHANCED BALANCE VALIDATION:
    // Strictly enforce balance limits for ALL paid leave types to prevent negative balances
    // Skip validation only for unpaid leaves (LOP, LWP) and restricted types without balance buckets
    const isPaid = !isUnpaidLeave(leaveType) && Boolean(leaveType.isPaid);
    const requiresBalanceCheck = isPaid && !isRestricted;

    if (requiresBalanceCheck) {
      // Fetch or initialize balances for the employee
      let balances = await leaveRepository.getLeaveBalances(targetEmp.id, startYear);
      if (balances.length === 0) {
        balances = await leaveRepository.initializeBalancesForEmployee(targetEmp.id, targetEmp.orgId, startYear);
      }

      // Find the matching balance record for this leave type
      const balance = balances.find(
        (b) =>
          b.leaveTypeId === leaveType.id ||
          (leaveType.code && b.leaveTypeCode && String(leaveType.code).toUpperCase() === String(b.leaveTypeCode).toUpperCase()) ||
          (leaveType.name && b.leaveTypeName && String(leaveType.name).toLowerCase() === String(b.leaveTypeName).toLowerCase())
      );

      if (!balance) {
        const error = new Error(`Leave balance record not found for '${leaveType.name}'. Please contact HR to initialize your leave allocations.`);
        error.statusCode = 400;
        throw error;
      }

      const remainingDays = parseFloat(balance.remainingDays) || 0;

      // CRITICAL CHECK 1: Block application if balance is exactly 0
      if (remainingDays === 0) {
        const error = new Error(
          `Insufficient leave balance. You have 0 days available for ${leaveType.name}. Please contact HR if you need additional leave allocation.`
        );
        error.statusCode = 400;
        throw error;
      }

      // CRITICAL CHECK 2: Block application if requested days exceed available balance
      if (totalDays > remainingDays) {
        const error = new Error(
          `Insufficient leave balance. You have only ${remainingDays} day${remainingDays === 1 ? '' : 's'} available for ${leaveType.name}, but requested ${totalDays} day${totalDays === 1 ? '' : 's'}.`
        );
        error.statusCode = 400;
        throw error;
      }

      // Additional safety check: ensure remaining balance is positive
      if (remainingDays < 0) {
        logger.warn('LeaveService', `Employee ${targetEmp.id} has negative balance (${remainingDays}) for leave type ${leaveType.id}. Blocking new application.`);
        const error = new Error(
          `Your leave balance for ${leaveType.name} is currently negative (${remainingDays} days). Please contact HR to resolve this issue before applying for new leave.`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // When assigned by authorized Admin/HR/Manager (!isSelf), it is directly APPROVED and recorded
    const isDirectAssignment = !isSelf;
    const initialStatus = isDirectAssignment ? 'APPROVED' : 'PENDING';

    // Update date decisions initial status if directly assigned
    if (isDirectAssignment) {
      dateDecisions = dateDecisions.map((d) => ({ ...d, status: 'APPROVED' }));
    }

    const assignerRole = isAdmin ? 'Admin' : isHr ? 'HR' : 'Manager';
    const reasonText = isSelf
      ? data.reason
      : `[Assigned by ${assignerRole}: ${callerEmp.firstName} ${callerEmp.lastName}] ${data.reason || 'Assigned leave'}`;

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
      status: initialStatus,
      approverId: isDirectAssignment ? (callerEmp.id || null) : null,
      approverUserId: isDirectAssignment ? user.id : null,
      reason: reasonText,
      dateDecisions,
    });

    if (isDirectAssignment) {
      // 1. Update balances for assigned leave accurately without creating incorrect balances
      if (isRestricted || isSpecialLeaveType(leaveType)) {
        await leaveRepository.recordAssignedLeaveBalance(
          targetEmp.id,
          targetEmp.orgId,
          leaveType.id,
          startYear,
          totalDays
        );
      } else {
        await leaveRepository.adjustBalance(targetEmp.id, leaveType.id, startYear, { usedDelta: totalDays });
      }

      // 2. Reflect assigned dates in attendance records
      await syncLeaveToAttendance(
        targetEmp,
        request,
        leaveType,
        startDate,
        endDate,
        isHalfDay,
        halfDayPeriod,
        dateDecisions
      );
    } else {
      // Employee self-applying leave: record pending balance only for paid leaves
      // Use atomic validation to prevent race conditions from duplicate submissions
      if (isPaid) {
        const balanceResult = await leaveRepository.adjustBalanceWithValidation(
          targetEmp.id, 
          leaveType.id, 
          startYear, 
          { pendingDelta: totalDays }
        );
        
        if (balanceResult && balanceResult.error === 'INSUFFICIENT_BALANCE') {
          const error = new Error(
            `Insufficient leave balance. You have ${balanceResult.currentRemaining} days remaining, but this request would require ${totalDays} days.`
          );
          error.statusCode = 400;
          throw error;
        }
        
        if (!balanceResult) {
          const error = new Error('Failed to reserve leave balance. Please try again.');
          error.statusCode = 500;
          throw error;
        }
      }
    }

    // Initialize approval workflow tracking instance
    try {
      await workflowRepository.createWorkflowInstance(
        {
          orgId: targetEmp.orgId,
          entityType: 'LEAVE_REQUEST',
          entityId: request.id,
          workflowType: isDirectAssignment ? 'DIRECT_ASSIGNMENT' : 'EMPLOYEE_MANAGER_HR',
          currentStage: isDirectAssignment ? 'COMPLETED' : 'MANAGER_REVIEW',
          currentStatus: initialStatus,
          requesterId: targetEmp.id,
          managerId: targetEmp.managerId || null,
        },
        {
          stage: isDirectAssignment ? 'ASSIGNMENT' : 'EMPLOYEE_SUBMISSION',
          actorUserId: user.id,
          actorRole: user.roleName || (isSelf ? 'Employee' : assignerRole),
          action: isDirectAssignment ? 'ASSIGN' : 'SUBMIT',
          fromStatus: 'PENDING',
          toStatus: initialStatus,
          comments: reasonText,
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
          eventType: 'LEAVE_ASSIGNED',
          title: `${leaveType.name} Assigned (${startDate} to ${endDate})`,
          message: `${callerEmp.firstName} ${callerEmp.lastName} (${assignerRole}) has assigned ${leaveType.name} (${totalDays} day${totalDays === 1 ? '' : 's'}) to you from ${startDate} to ${endDate}.`,
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
    const allRoles = (Array.isArray(user.roles) ? user.roles : [user.roleName || user.role || ''])
      .filter(Boolean)
      .map((r) => String(r).toLowerCase());
    const isAdminOrCeo =
      allRoles.some((r) => ['admin', 'superadmin', 'orgadmin'].some((adm) => r.includes(adm))) ||
      (user.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';

    if (isAdminOrCeo) {
      return {
        records: [],
        pagination: { total: 0, page: 1, limit: 15, totalPages: 0 },
      };
    }

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

    // Revert balances (only for normal leave types)
    const leaveType = await leaveRepository.findLeaveTypeById(record.leaveTypeId, record.orgId);
    if (!isSpecialLeaveType(leaveType)) {
      const year = new Date(record.startDate).getFullYear();
      if (previousStatus === 'PENDING') {
        await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, { pendingDelta: -record.totalDays });
      } else if (previousStatus === 'APPROVED') {
        await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, { usedDelta: -record.totalDays });
      }
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

    // 1. Resolve date decisions list from record or reconstruct from range
    let currentDecisions = Array.isArray(record.dateDecisions) && record.dateDecisions.length > 0
      ? [...record.dateDecisions]
      : [];

    if (currentDecisions.length === 0) {
      const s = parseLocalDate(record.startDate);
      const e = parseLocalDate(record.endDate);
      if (s && e) {
        const cur = new Date(s.getTime());
        while (cur <= e) {
          const curStr = formatLocalDate(cur);
          if (cur.getDay() !== 0) { // skip Sunday
            currentDecisions.push({
              date: curStr,
              status: 'PENDING',
              dayFraction: record.isHalfDay ? 0.5 : 1.0,
              reason: '',
            });
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
      if (currentDecisions.length === 0) {
        currentDecisions.push({
          date: record.startDate,
          status: 'PENDING',
          dayFraction: record.isHalfDay ? 0.5 : record.totalDays,
          reason: '',
        });
      }
    }

    // 2. Evaluate approver decisions per date
    let updatedDecisions = [];
    if (Array.isArray(options.dateDecisions) && options.dateDecisions.length > 0) {
      const decisionMap = new Map();
      for (const d of options.dateDecisions) {
        if (d && d.date) {
          decisionMap.set(String(d.date).trim(), d);
        }
      }

      updatedDecisions = currentDecisions.map((item) => {
        const decision = decisionMap.get(item.date);
        if (decision) {
          const dStatus = String(decision.status).trim().toUpperCase();
          return {
            ...item,
            status: dStatus === 'REJECTED' ? 'REJECTED' : 'APPROVED',
            reason: decision.reason || item.reason || '',
          };
        }
        return {
          ...item,
          status: 'APPROVED',
        };
      });
    } else {
      // Default: approve all dates
      updatedDecisions = currentDecisions.map((item) => ({
        ...item,
        status: 'APPROVED',
      }));
    }

    const approvedItems = updatedDecisions.filter((d) => d.status === 'APPROVED');
    const rejectedItems = updatedDecisions.filter((d) => d.status === 'REJECTED');
    const approvedDays = approvedItems.reduce((sum, d) => sum + (parseFloat(d.dayFraction) || 1.0), 0);
    const isAllRejected = approvedItems.length === 0;
    const isPartiallyApproved = approvedItems.length > 0 && rejectedItems.length > 0;

    const finalStatus = isAllRejected ? 'REJECTED' : 'APPROVED';
    const finalTotalDays = isAllRejected ? record.totalDays : approvedDays;
    const rejectionReasonText = isAllRejected
      ? (options.comments || options.rejectionReason || 'All requested dates were rejected.')
      : (isPartiallyApproved ? (options.comments || 'Some dates rejected.') : '');

    // REVALIDATE BALANCE AT APPROVAL TIME (Prevent race conditions and duplicate approvals)
    // Only validate for paid normal leave types with balance buckets
    const year = new Date(record.startDate).getFullYear();
    const leaveType = await leaveRepository.findLeaveTypeById(record.leaveTypeId, record.orgId);
    const isSpecialLeave = isSpecialLeaveType(leaveType);
    const isPaidLeave = leaveType && !isUnpaidLeave(leaveType) && Boolean(leaveType.isPaid);
    const requiresBalanceCheck = !isAllRejected && isPaidLeave && !isSpecialLeave;

    if (requiresBalanceCheck) {
      // Fetch current balance to verify sufficient remaining days
      const balances = await leaveRepository.getLeaveBalances(record.employeeId, year);
      const balance = balances.find((b) => b.leaveTypeId === record.leaveTypeId);

      if (balance) {
        const currentRemaining = parseFloat(balance.remainingDays) || 0;
        const projectedRemaining = currentRemaining + record.totalDays - approvedDays;

        if (projectedRemaining < 0) {
          const error = new Error(
            `Cannot approve leave: This would result in a negative balance. Employee currently has ${currentRemaining} days remaining for ${leaveType.name}. Approving ${approvedDays} days would create a balance deficit of ${Math.abs(projectedRemaining)} days.`
          );
          error.statusCode = 400;
          throw error;
        }

        // Additional safety: Check if current balance is already negative (data integrity issue)
        if (currentRemaining < 0) {
          logger.warn('LeaveService', `Employee ${record.employeeId} has negative balance (${currentRemaining}) for leave type ${record.leaveTypeId}. Blocking approval.`);
          const error = new Error(
            `Cannot approve leave: Employee's current balance for ${leaveType.name} is negative (${currentRemaining} days). Please contact HR to resolve this data integrity issue.`
          );
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // 3. Update status in database
    const updated = await leaveRepository.updateStatus(id, {
      status: finalStatus,
      approverId: approverEmp?.id || null,
      approverUserId: user.id,
      totalDays: finalTotalDays,
      dateDecisions: updatedDecisions,
      rejectionReason: rejectionReasonText,
    });

    // 4. Update employee balances:
    // Only adjust balance for non-special normal leaves
    if (!isSpecialLeave) {
      const balanceResult = await leaveRepository.adjustBalanceWithValidation(
        record.employeeId, 
        record.leaveTypeId, 
        year, 
        {
          pendingDelta: -record.totalDays,
          usedDelta: isAllRejected ? 0 : approvedDays,
        }
      );

      if (balanceResult && balanceResult.error === 'INSUFFICIENT_BALANCE') {
        const error = new Error(
          `Cannot complete approval: Balance adjustment would result in negative balance. Current: ${balanceResult.currentRemaining}, Required: ${approvedDays}`
        );
        error.statusCode = 400;
        throw error;
      }

      if (!balanceResult) {
        logger.warn('LeaveService', `Failed to adjust balance for leave ${id} during approval`);
      }
    } else {
      // For special leaves: ensure balance record exists with 0 days and is never deducted
      await leaveRepository.recordAssignedLeaveBalance(
        record.employeeId,
        record.orgId,
        record.leaveTypeId,
        year,
        0
      );
    }

    // 5. Advance workflow state machine
    if (!options.skipWorkflowSync) {
      try {
        const wf = await workflowRepository.findByEntity('LEAVE_REQUEST', id);
        if (wf) {
          await workflowRepository.recordAction(wf.id, {
            stage: wf.currentStage || 'MANAGER_REVIEW',
            actorUserId: user.id,
            actorRole: user.roleName || 'Approver',
            action: isAllRejected ? 'REJECT' : 'APPROVE',
            fromStatus: 'PENDING',
            toStatus: finalStatus,
            nextStage: 'COMPLETED',
            comments: options.comments || (isAllRejected ? 'Rejected' : isPartiallyApproved ? `Partially approved ${approvedDays} of ${record.totalDays} days.` : 'Leave request approved.'),
          });
        }
      } catch (wfErr) {
        logger.warn('LeaveService', `Failed to advance workflow audit for leave ${id}: ${wfErr.message}`);
      }
    }

    // 6. Reflect approved leave dates in attendance records (only approved dates, delete rejected)
    if (!isAllRejected) {
      try {
        const leaveType = await leaveRepository.findLeaveTypeById(record.leaveTypeId, record.orgId);
        const emp = await employeeRepository.findById(record.employeeId);
        if (emp && leaveType) {
          await syncLeaveToAttendance(
            emp,
            record,
            leaveType,
            record.startDate,
            record.endDate,
            record.isHalfDay,
            record.halfDayPeriod,
            updatedDecisions
          );
        }
      } catch (syncErr) {
        logger.warn('LeaveService', `Failed to sync approved leave to attendance: ${syncErr.message}`);
      }
    }

    // 7. Send in-app system notification to employee detailing approved/rejected dates
    try {
      const emp = await employeeRepository.findById(record.employeeId);
      if (emp && emp.userId) {
        let notifTitle = 'Leave Request Approved';
        let notifMsg = `Your leave request from ${record.startDate} to ${record.endDate} has been approved (${approvedDays} day${approvedDays === 1 ? '' : 's'}).`;

        if (isAllRejected) {
          notifTitle = 'Leave Request Declined';
          notifMsg = `All requested dates for your leave request (${record.startDate} to ${record.endDate}) were declined.`;
        } else if (isPartiallyApproved) {
          notifTitle = 'Leave Request Partially Approved';
          const appDatesStr = approvedItems.map((d) => d.date).join(', ');
          const rejDatesStr = rejectedItems.map((d) => d.date).join(', ');
          notifMsg = `Your leave request was partially approved (${approvedDays} of ${record.totalDays} day${record.totalDays === 1 ? '' : 's'} approved). Approved: ${appDatesStr}. Rejected: ${rejDatesStr}.`;
        }

        if (options.comments) {
          notifMsg += ` Comments: "${options.comments}"`;
        }

        await notificationService.createSystemNotification({
          orgId: user.orgId,
          userId: emp.userId,
          eventType: isAllRejected ? 'LEAVE_REJECTED' : 'LEAVE_APPROVED',
          title: notifTitle,
          message: notifMsg,
          entityType: 'LEAVE_REQUEST',
          entityId: record.id,
          actionUrl: '/leaves',
        });
      }
    } catch (notifErr) {
      logger.warn('LeaveService', `Failed to dispatch notification for leave ${id}: ${notifErr.message}`);
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

    // Mark all dates as rejected
    let allRejectedDecisions = [];
    if (Array.isArray(record.dateDecisions) && record.dateDecisions.length > 0) {
      allRejectedDecisions = record.dateDecisions.map((d) => ({
        ...d,
        status: 'REJECTED',
        reason: rejectionReason,
      }));
    } else {
      const s = parseLocalDate(record.startDate);
      const e = parseLocalDate(record.endDate);
      if (s && e) {
        const cur = new Date(s.getTime());
        while (cur <= e) {
          allRejectedDecisions.push({
            date: formatLocalDate(cur),
            status: 'REJECTED',
            dayFraction: record.isHalfDay ? 0.5 : 1.0,
            reason: rejectionReason,
          });
          cur.setDate(cur.getDate() + 1);
        }
      }
      if (allRejectedDecisions.length === 0) {
        allRejectedDecisions.push({
          date: record.startDate,
          status: 'REJECTED',
          dayFraction: record.isHalfDay ? 0.5 : record.totalDays,
          reason: rejectionReason,
        });
      }
    }

    // Transition status to REJECTED
    const updated = await leaveRepository.updateStatus(id, {
      status: 'REJECTED',
      approverId: approverEmp?.id || null,
      approverUserId: user.id,
      rejectionReason,
      dateDecisions: allRejectedDecisions,
    });

    // Release pending balance (only for normal leave types)
    const leaveType = await leaveRepository.findLeaveTypeById(record.leaveTypeId, record.orgId);
    if (!isSpecialLeaveType(leaveType)) {
      const year = new Date(record.startDate).getFullYear();
      await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, {
        pendingDelta: -record.totalDays,
      });
    }

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

  /**
   * Edit / Update Leave Request (Admin, HR, or Reporting Manager)
   * Allows correcting mistaken leave category, dates, duration, or reason.
   * Accurately reverts previous balance/attendance impact and applies new category rules.
   */
  async updateLeave(user, id, data) {
    const record = await leaveRepository.findById(id);
    if (!record) {
      const error = new Error('Leave request not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName || user.role);
    const isAdmin =
      ['admin', 'superadmin', 'orgadmin'].includes(normRole) ||
      (user.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';
    const isHr = ['hr', 'hrmanager'].includes(normRole);
    const isManager = ['manager', 'lead', 'teamlead', 'supervisor'].includes(normRole);

    if (!isAdmin && !isHr && !isManager) {
      const error = new Error('Access denied: Only Admin, HR, or Reporting Manager can edit leave requests.');
      error.statusCode = 403;
      throw error;
    }

    // Organization boundary check
    if (!isAdmin && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Leave request belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Manager scope check: can only edit for employees reporting to them or in their department
    if (isManager && !isAdmin && !isHr) {
      const managerEmp = await resolveRequesterEmployee(user);
      const isDirectReport = managerEmp && record.employee && record.employee.managerId === managerEmp.id;
      const isDeptMatch = managerEmp && managerEmp.deptId && record.employee && record.employee.deptId === managerEmp.deptId;
      if (!isDirectReport && !isDeptMatch) {
        const error = new Error('Access denied: Managers can only edit leave requests for employees within their team or department.');
        error.statusCode = 403;
        throw error;
      }
    }

    const oldLeaveTypeId = record.leaveTypeId;
    const oldLeaveType = await leaveRepository.findLeaveTypeById(oldLeaveTypeId, record.orgId);
    const oldYear = new Date(record.startDate).getFullYear();
    const oldTotalDays = parseFloat(record.totalDays) || 0;
    const oldStatus = (record.status || '').toUpperCase();
    const oldIsSpecial = isSpecialLeaveType(oldLeaveType);
    const oldIsPaid = oldLeaveType && !isUnpaidLeave(oldLeaveType) && Boolean(oldLeaveType.isPaid);

    const newLeaveTypeId = data.leaveTypeId || oldLeaveTypeId;
    const newLeaveType = await leaveRepository.findLeaveTypeById(newLeaveTypeId, record.orgId);
    if (!newLeaveType) {
      const error = new Error('Selected leave type does not exist.');
      error.statusCode = 400;
      throw error;
    }

    const newStartDate = data.startDate ? String(data.startDate).trim() : String(record.startDate).split('T')[0];
    const newEndDate = data.endDate ? String(data.endDate).trim() : (data.startDate ? String(data.startDate).trim() : String(record.endDate).split('T')[0]);
    const newIsHalfDay = data.isHalfDay !== undefined ? Boolean(data.isHalfDay) : Boolean(record.isHalfDay);
    const newHalfDayPeriod = newIsHalfDay ? (data.halfDayPeriod || record.halfDayPeriod || 'FIRST_HALF') : null;
    const newYear = new Date(newStartDate).getFullYear();

    const newIsSpecial = isSpecialLeaveType(newLeaveType);
    const newIsPaid = newLeaveType && !isUnpaidLeave(newLeaveType) && Boolean(newLeaveType.isPaid);

    // Calculate new duration
    let newTotalDays = oldTotalDays;
    let newDateDecisions = [];
    const dayFactor = newIsHalfDay ? 0.5 : 1.0;

    if (Array.isArray(data.dates) && data.dates.length > 0) {
      const rawDates = data.dates
        .map((d) => String(d).trim())
        .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
      const uniqueDates = Array.from(new Set(rawDates)).sort();
      newTotalDays = uniqueDates.length * dayFactor;
      newDateDecisions = uniqueDates.map((d) => ({
        date: d,
        status: oldStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
        dayFraction: dayFactor,
        reason: '',
      }));
    } else {
      const calculation = await calculateLeaveDuration(
        record.orgId,
        newStartDate,
        newEndDate,
        newIsHalfDay,
        newHalfDayPeriod,
        false,
        newIsSpecial
      );
      newTotalDays = calculation.totalDays;

      // Expand dates
      const holidays = await leaveRepository.findActiveHolidaysBetween(record.orgId, newStartDate, newEndDate);
      const holidaySet = new Set(holidays.map((h) => h.holiday_date));
      const sDate = parseLocalDate(newStartDate);
      const eDate = parseLocalDate(newEndDate);
      const cur = new Date(sDate.getTime());

      while (cur <= eDate) {
        const curStr = formatLocalDate(cur);
        const isSunday = cur.getDay() === 0;
        const isHoliday = holidaySet.has(curStr);

        if (newIsSpecial || (!isSunday && !isHoliday)) {
          newDateDecisions.push({
            date: curStr,
            status: oldStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
            dayFraction: dayFactor,
            reason: '',
          });
        }
        cur.setDate(cur.getDate() + 1);
      }
      if (newDateDecisions.length === 0) {
        newDateDecisions.push({
          date: newStartDate,
          status: oldStatus === 'APPROVED' ? 'APPROVED' : 'PENDING',
          dayFraction: dayFactor,
          reason: '',
        });
      }
    }

    // Overlap check (excluding current leave request id)
    const overlapSql = `
      SELECT id, status, start_date, end_date
      FROM leave_requests
      WHERE employee_id = $1
        AND id != $2
        AND UPPER(status) NOT IN ('CANCELLED', 'REJECTED')
        AND (start_date <= $4::date AND end_date >= $3::date)
      LIMIT 1;
    `;
    const overlapRes = await pool.query(overlapSql, [record.employeeId, id, newStartDate, newEndDate]);
    if (overlapRes.rows.length > 0) {
      const ov = overlapRes.rows[0];
      const error = new Error(`Overlapping leave conflict: Employee already has an active ${ov.status} leave request from ${ov.start_date} to ${ov.end_date}.`);
      error.statusCode = 409;
      throw error;
    }

    // 1. Revert previous balance impact
    if (oldStatus === 'APPROVED') {
      if (!oldIsSpecial && oldIsPaid) {
        await leaveRepository.adjustBalance(record.employeeId, oldLeaveTypeId, oldYear, { usedDelta: -oldTotalDays });
      }
    } else if (oldStatus === 'PENDING') {
      if (!oldIsSpecial && oldIsPaid) {
        await leaveRepository.adjustBalance(record.employeeId, oldLeaveTypeId, oldYear, { pendingDelta: -oldTotalDays });
      }
    }

    // 2. Validate new balance if new type is paid normal leave
    if (newIsPaid && !newIsSpecial) {
      const balances = await leaveRepository.getLeaveBalances(record.employeeId, newYear);
      const bal = balances.find((b) => b.leaveTypeId === newLeaveTypeId);
      const remainingDays = bal ? (parseFloat(bal.remainingDays) || 0) : 0;
      if (remainingDays < newTotalDays) {
        // Restore old balance before throwing
        if (oldStatus === 'APPROVED' && !oldIsSpecial && oldIsPaid) {
          await leaveRepository.adjustBalance(record.employeeId, oldLeaveTypeId, oldYear, { usedDelta: oldTotalDays });
        } else if (oldStatus === 'PENDING' && !oldIsSpecial && oldIsPaid) {
          await leaveRepository.adjustBalance(record.employeeId, oldLeaveTypeId, oldYear, { pendingDelta: oldTotalDays });
        }
        const error = new Error(`Insufficient leave balance for ${newLeaveType.name}. Employee has ${remainingDays} days available, but edited leave requires ${newTotalDays} days.`);
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Apply new balance impact
    if (oldStatus === 'APPROVED') {
      if (newIsSpecial) {
        await leaveRepository.recordAssignedLeaveBalance(record.employeeId, record.orgId, newLeaveTypeId, newYear, newTotalDays);
      } else if (newIsPaid) {
        await leaveRepository.adjustBalance(record.employeeId, newLeaveTypeId, newYear, { usedDelta: newTotalDays });
      }
    } else if (oldStatus === 'PENDING') {
      if (!newIsSpecial && newIsPaid) {
        await leaveRepository.adjustBalance(record.employeeId, newLeaveTypeId, newYear, { pendingDelta: newTotalDays });
      }
    }

    // 4. Update attendance records if approved
    if (oldStatus === 'APPROVED') {
      // Remove previous attendance records for old dates
      await pool.query(
        `DELETE FROM attendance_records
         WHERE employee_id = $1
           AND attendance_date BETWEEN $2::date AND $3::date
           AND source = 'LEAVE_ASSIGNMENT'`,
        [record.employeeId, record.startDate, record.endDate]
      );

      // Re-sync new attendance records
      const targetEmp = await employeeRepository.findById(record.employeeId);
      await syncLeaveToAttendance(
        targetEmp,
        { id },
        newLeaveType,
        newStartDate,
        newEndDate,
        newIsHalfDay,
        newHalfDayPeriod,
        newDateDecisions
      );
    }

    // 5. Update reason if provided
    const newReason = data.reason !== undefined ? data.reason : record.reason;

    // 6. Update database record
    const updated = await leaveRepository.updateLeaveRequest(id, {
      leaveTypeId: newLeaveTypeId,
      startDate: newStartDate,
      endDate: newEndDate,
      isHalfDay: newIsHalfDay,
      halfDayPeriod: newHalfDayPeriod,
      totalDays: newTotalDays,
      reason: newReason,
      dateDecisions: newDateDecisions,
    });

    return updated;
  },

  /**
   * Delete Leave Request (Admin, HR, or Reporting Manager)
   * Safely deletes mistaken leave entry, reverses balances and cleans up attendance marks.
   */
  async deleteLeave(user, id) {
    const record = await leaveRepository.findById(id);
    if (!record) {
      const error = new Error('Leave request not found.');
      error.statusCode = 404;
      throw error;
    }

    const normRole = normalizeRole(user.roleName || user.role);
    const isAdmin =
      ['admin', 'superadmin', 'orgadmin'].includes(normRole) ||
      (user.email || '').toLowerCase() === 'sheetalbedi@tasknera.com';
    const isHr = ['hr', 'hrmanager'].includes(normRole);
    const isManager = ['manager', 'lead', 'teamlead', 'supervisor'].includes(normRole);

    if (!isAdmin && !isHr && !isManager) {
      const error = new Error('Access denied: Only Admin, HR, or Reporting Manager can delete leave requests.');
      error.statusCode = 403;
      throw error;
    }

    // Organization boundary check
    if (!isAdmin && record.orgId !== user.orgId) {
      const error = new Error('Access denied: Leave request belongs to a different organization.');
      error.statusCode = 403;
      throw error;
    }

    // Manager scope check: can only delete for employees reporting to them
    if (isManager && !isAdmin && !isHr) {
      const managerEmp = await resolveRequesterEmployee(user);
      const isDirectReport = managerEmp && record.employee && record.employee.managerId === managerEmp.id;
      const isDeptMatch = managerEmp && managerEmp.deptId && record.employee && record.employee.deptId === managerEmp.deptId;
      if (!isDirectReport && !isDeptMatch) {
        const error = new Error('Access denied: Managers can only delete leave requests for employees within their team or department.');
        error.statusCode = 403;
        throw error;
      }
    }

    const year = new Date(record.startDate).getFullYear();
    const leaveType = await leaveRepository.findLeaveTypeById(record.leaveTypeId, record.orgId);
    const isSpecial = isSpecialLeaveType(leaveType);
    const isPaid = leaveType && !isUnpaidLeave(leaveType) && Boolean(leaveType.isPaid);

    // 1. Revert balance impact:
    if (record.status === 'APPROVED') {
      if (!isSpecial && isPaid) {
        await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, { usedDelta: -record.totalDays });
      }
    } else if (record.status === 'PENDING') {
      if (!isSpecial && isPaid) {
        await leaveRepository.adjustBalance(record.employeeId, record.leaveTypeId, year, { pendingDelta: -record.totalDays });
      }
    }

    // 2. Revert attendance records for this leave assignment if approved
    if (record.status === 'APPROVED') {
      const sDate = parseLocalDate(record.startDate);
      const eDate = parseLocalDate(record.endDate);
      if (sDate && eDate) {
        await pool.query(
          `DELETE FROM attendance_records
           WHERE employee_id = $1
             AND attendance_date BETWEEN $2::date AND $3::date
             AND source = 'LEAVE_ASSIGNMENT'`,
          [record.employeeId, record.startDate, record.endDate]
        );
      }
    }

    // 3. Delete associated notifications
    try {
      await pool.query('DELETE FROM notifications WHERE entity_id = $1', [id]);
    } catch (nErr) {
      logger.warn('LeaveService', `Failed to delete notifications for leave ${id}: ${nErr.message}`);
    }

    // 4. Delete associated workflow instances
    try {
      await pool.query('DELETE FROM approval_workflows WHERE entity_id = $1', [id]);
    } catch (wfErr) {
      logger.warn('LeaveService', `Failed to delete workflow instances for leave ${id}: ${wfErr.message}`);
    }

    // 5. Delete the leave request record
    await leaveRepository.deleteLeaveRequest(id);

    return {
      success: true,
      message: 'Leave request deleted successfully.',
    };
  },
};
