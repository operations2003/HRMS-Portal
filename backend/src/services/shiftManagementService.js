import { pool } from '../config/db.js';
import { parseShiftTiming } from '../utils/shiftUtils.js';
import { logger } from '../utils/logger.js';
import { nanoid } from 'nanoid';
import { determineAttendanceStatus, calculateWorkingHoursAndOvertime } from './attendanceService.js';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const shiftManagementService = {
  /**
   * Check if caller is HR or Admin or authorized HR Operations personnel
   */
  isHrOrAdmin(user) {
    if (!user) return false;
    const role = normalizeRole(user?.roleName || user?.role?.name || user?.role || '');
    if (['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'management', 'ceo', 'director'].includes(role)) {
      return true;
    }

    const allRoles = (Array.isArray(user?.roles) ? user.roles : [user?.roleName || user?.role || ''])
      .filter(Boolean)
      .map(normalizeRole);
    if (allRoles.some((r) => ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'ceo', 'director'].some((adm) => r.includes(adm)))) {
      return true;
    }

    // Check department / title
    const dept = (user.departmentName || user.department?.name || '').toLowerCase();
    if (dept.includes('hr') || dept.includes('operations')) {
      return true;
    }

    // Check email prefixes
    const email = (user.email || '').toLowerCase();
    if (email.startsWith('operations@') || email.startsWith('admin@') || email.startsWith('hr@')) {
      return true;
    }

    // Check permissions
    const perms = Array.isArray(user.permissions) ? user.permissions : [];
    if (perms.includes('employee:write') || perms.includes('attendance:write') || perms.includes('admin:read') || perms.includes('org:write')) {
      return true;
    }

    return false;
  },

  /**
   * Check if caller is a Manager
   */
  isManager(user) {
    if (!user) return false;
    const role = normalizeRole(user?.roleName || user?.role?.name || user?.role || '');
    if (role.includes('manager') || role === 'teamlead' || role === 'supervisor') return true;

    const allRoles = (Array.isArray(user?.roles) ? user.roles : [user?.roleName || user?.role || ''])
      .filter(Boolean)
      .map(normalizeRole);
    return allRoles.some((r) => r.includes('manager') || r === 'teamlead' || r === 'supervisor');
  },

  /**
   * Check if caller is Manager, CEO, HR, or Admin who is authorized to see everyone's records
   */
  canSeeEveryone(user) {
    if (!user) return false;
    if (this.isHrOrAdmin(user)) return true;
    if (this.isManager(user)) return true;
    const role = normalizeRole(user?.roleName || user?.role?.name || user?.role || '');
    if (
      role === 'ceo' ||
      role === 'director' ||
      (user?.email || '').toLowerCase() === 'sheetalbedi@tasknera.com' ||
      (user?.designationTitle || '').toUpperCase() === 'CEO'
    ) {
      return true;
    }
    return false;
  },

  /**
   * Resolve caller's employee profile
   */
  async resolveCallerEmployee(user) {
    if (!user || !user.id) return null;
    let empRes = await pool.query(
      `SELECT * FROM employees WHERE user_id = $1 OR LOWER(email) = LOWER($2) LIMIT 1;`,
      [user.id, user.email || '']
    );
    return empRes.rows[0] || null;
  },

  /**
   * Verify caller has permission to view or manage the target employee
   */
  async assertCanManageEmployee(currentUser, targetEmployeeId) {
    if (this.canSeeEveryone(currentUser)) {
      return true;
    }

    const err = new Error('Access denied: Regular employees can only view their own record and cannot modify shifts.');
    err.statusCode = 403;
    throw err;
  },

  /**
   * Check if an employee record represents the CEO
   */
  isCeoEmployee(emp) {
    if (!emp) return false;
    const id = emp.id || emp.employeeId;
    const email = (emp.email || '').toLowerCase();
    const desig = (emp.designationTitle || emp.designation?.title || emp.desig_title || '').toLowerCase();
    return (
      id === 'emp-shubham-admin' ||
      email === 'sheetalbedi@tasknera.com' ||
      email === 'sheetal@tasknera.com' ||
      desig.includes('ceo')
    );
  },

  /**
   * Get eligible employees for shift management:
   * - Manager, CEO, HR, and Admin can see everyone's records (all active non-CEO employees)
   * - Regular employee can see ONLY their own record
   */
  async getEligibleEmployees(currentUser) {
    const orgId = currentUser.orgId || 'org-1';

    // Manager, CEO, HR, and Admin can see everyone's record (excluding CEO)
    if (this.canSeeEveryone(currentUser)) {
      const res = await pool.query(
        `SELECT 
          e.id,
          e.employee_code AS "employeeCode",
          e.first_name AS "firstName",
          e.last_name AS "lastName",
          TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "fullName",
          e.email,
          e.shift_timing AS "defaultShiftTiming",
          COALESCE(e.avatar_url, u.avatar_url) AS "avatarUrl",
          d.name AS "departmentName",
          e.dept_id AS "departmentId",
          e.dept_id AS "deptId",
          ds.title AS "designationTitle",
          e.manager_id AS "managerId",
          (SELECT COUNT(*)::int FROM shift_assignments sa WHERE sa.employee_id = e.id AND sa.assignment_date >= DATE_TRUNC('month', CURRENT_DATE) AND sa.assignment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') AS "customShiftCount"
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN departments d ON d.id = e.dept_id
        LEFT JOIN designations ds ON ds.id = e.desig_id
        WHERE (e.org_id = $1 OR e.org_id IS NULL OR $1 = '')
          AND (e.status IS NULL OR LOWER(e.status) NOT IN ('exited', 'terminated', 'inactive', 'suspended', 'archived'))
          AND (e.id != 'emp-shubham-admin')
          AND LOWER(COALESCE(e.email, '')) NOT IN ('sheetalbedi@tasknera.com', 'sheetal@tasknera.com')
          AND LOWER(COALESCE(ds.title, '')) NOT LIKE '%ceo%'
        ORDER BY e.first_name ASC, e.last_name ASC;`,
        [orgId]
      );
      return res.rows;
    }

    // Every employee can see ONLY their own record
    const callerEmp = await this.resolveCallerEmployee(currentUser);
    if (!callerEmp) {
      return [];
    }

    const selfRes = await pool.query(
      `SELECT 
        e.id,
        e.employee_code AS "employeeCode",
        e.first_name AS "firstName",
        e.last_name AS "lastName",
        TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "fullName",
        e.email,
        e.shift_timing AS "defaultShiftTiming",
        COALESCE(e.avatar_url, u.avatar_url) AS "avatarUrl",
        d.name AS "departmentName",
        e.dept_id AS "departmentId",
        e.dept_id AS "deptId",
        ds.title AS "designationTitle",
        e.manager_id AS "managerId",
        (SELECT COUNT(*)::int FROM shift_assignments sa WHERE sa.employee_id = e.id AND sa.assignment_date >= DATE_TRUNC('month', CURRENT_DATE) AND sa.assignment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') AS "customShiftCount"
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN departments d ON d.id = e.dept_id
      LEFT JOIN designations ds ON ds.id = e.desig_id
      WHERE e.id = $1
      LIMIT 1;`,
      [callerEmp.id]
    );
    return selfRes.rows;
  },

  /**
   * Helper to format work minutes into hours and minutes string
   */
  formatWorkMinutes(workMinutes) {
    if (!workMinutes || workMinutes <= 0) return '0h 0m';
    const hrs = Math.floor(workMinutes / 60);
    const mins = workMinutes % 60;
    return `${hrs}h ${mins}m`;
  },

  /**
   * Helper to produce concise display label for shifts (e.g. "11-7", "WO")
   */
  getShortShiftLabel(label, startTime = null, endTime = null) {
    if (!label && !startTime) return '-';
    const clean = (label || '').trim();
    if (/^wo\b|weekly\s*off/i.test(clean)) return 'WO';
    if (/^hd\b|half\s*day/i.test(clean)) return 'HD';
    if (/^cl\b|casual\s*leave/i.test(clean)) return 'CL';
    if (/^pl\b|planned\s*leave|paid\s*leave/i.test(clean)) return 'PL';
    if (/^sl\b|sick\s*leave/i.test(clean)) return 'SL';
    if (/^lop\b|^lwp\b|unpaid/i.test(clean)) return 'UP';
    if (/^na$/i.test(clean)) return 'NA';

    // Parse shift string matching PDF style: "11 - 8 PM", "12 - 6 PM", "2 - 8 PM", "5 - 11 PM", "2 - 10 PM"
    const match = clean.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*[-–—+to]+\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      const sH = parseInt(match[1], 10);
      const sM = match[2] && match[2] !== '00' ? `:${match[2]}` : '';
      const sAmPm = match[3] ? match[3].toUpperCase() : '';

      const eH = parseInt(match[4], 10);
      const eM = match[5] && match[5] !== '00' ? `:${match[5]}` : '';
      const eAmPm = match[6] ? match[6].toUpperCase() : (eH <= 11 || eH === 12 ? 'PM' : '');

      return `${sH}${sM} - ${eH}${eM} ${eAmPm || 'PM'}`.trim();
    }

    if (startTime && endTime) {
      const sParts = String(startTime).split(':');
      const eParts = String(endTime).split(':');
      let sH = parseInt(sParts[0], 10);
      let eH = parseInt(eParts[0], 10);
      const sM = sParts[1] && sParts[1] !== '00' ? `:${sParts[1]}` : '';
      const eM = eParts[1] && eParts[1] !== '00' ? `:${eParts[1]}` : '';
      const sAmPm = sH >= 12 ? 'PM' : 'AM';
      const eAmPm = eH >= 12 ? 'PM' : 'AM';
      sH = sH > 12 ? sH - 12 : sH === 0 ? 12 : sH;
      eH = eH > 12 ? eH - 12 : eH === 0 ? 12 : eH;
      return `${sH}${sM} - ${eH}${eM} ${eAmPm}`;
    }

    return clean;
  },

  /**
   * Get organization-wide or team monthly roster in rows (employees) and columns (days 1..N)
   * Designed specifically for Admin, HR, and Managers to view all employees together.
   */

  async getOrganizationMonthlyRoster(currentUser, { month, year, startDate, endDate, departmentId, employeeId }) {
    // If not Manager, CEO, or HR/Admin, regular employee can only view their own record
    if (!this.canSeeEveryone(currentUser)) {
      const callerEmp = await this.resolveCallerEmployee(currentUser);
      if (!callerEmp) {
        const err = new Error('Access denied: Caller employee record not found.');
        err.statusCode = 403;
        throw err;
      }
      employeeId = callerEmp.id;
    }

    const orgId = currentUser.orgId || 'org-1';

    // 1. Fetch eligible employees for this caller (strictly excluding CEO from roster)
    let eligibleEmployees = (await this.getEligibleEmployees(currentUser)).filter(
      (e) => !this.isCeoEmployee(e)
    );

    // Optional employeeId filtering (if specific employee selected)
    if (employeeId && employeeId !== 'ALL' && employeeId !== 'all') {
      eligibleEmployees = eligibleEmployees.filter((e) => e.id === employeeId);
    }

    // Optional department filtering
    if (departmentId && departmentId !== 'ALL' && departmentId !== '') {
      eligibleEmployees = eligibleEmployees.filter(
        (e) => (e.departmentId === departmentId || e.departmentName === departmentId || e.dept_id === departmentId)
      );
    }

    // 2. Compute date range
    let start = startDate;
    let end = endDate;
    let y = year ? parseInt(year, 10) : new Date().getFullYear();
    let m = month ? parseInt(month, 10) : new Date().getMonth() + 1;

    if (!start || !end) {
      const mStr = String(m).padStart(2, '0');
      start = start || `${y}-${mStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      end = end || `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    } else {
      // If dates provided, infer y and m from start
      const parts = start.split('-');
      if (parts.length >= 2) {
        y = parseInt(parts[0], 10) || y;
        m = parseInt(parts[1], 10) || m;
      }
    }

    // 3. Generate columns metadata for each day in range
    const days = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const startObj = new Date(`${start}T00:00:00`);
    const endObj = new Date(`${end}T00:00:00`);
    const curr = new Date(startObj);

    while (curr <= endObj) {
      const currY = curr.getFullYear();
      const currM = String(curr.getMonth() + 1).padStart(2, '0');
      const currD = String(curr.getDate()).padStart(2, '0');
      const dateKey = `${currY}-${currM}-${currD}`;
      const dayOfWeek = curr.getDay();
      const isSunday = dayOfWeek === 0;
      const isWeekend = isSunday;
      days.push({
        dayNumber: curr.getDate(),
        dateKey,
        dayName: weekdayNames[dayOfWeek],
        isWeekend,
        isSunday,
      });
      curr.setDate(curr.getDate() + 1);
    }

    if (eligibleEmployees.length === 0) {
      return {
        isAllEmployees: true,
        range: { startDate: start, endDate: end },
        month: m,
        year: y,
        totalEmployees: 0,
        days,
        departments: [],
        holidaysByDate: {},
        roster: [],
        summary: {
          totalEmployees: 0,
          totalOverrides: 0,
          totalAttendancePunches: 0,
          totalApprovedLeaves: 0,
          totalHolidays: 0,
        },
      };
    }

    const empIds = eligibleEmployees.map((e) => e.id);

    // 4. Batch query shift_assignments
    const shiftRes = await pool.query(
      `SELECT 
        id,
        employee_id AS "employeeId",
        TO_CHAR(assignment_date, 'YYYY-MM-DD') AS "assignmentDate",
        shift_type AS "shiftType",
        shift_start_time AS "shiftStartTime",
        shift_end_time AS "shiftEndTime",
        shift_label AS "shiftLabel",
        is_overnight AS "isOvernight",
        notes,
        source
      FROM shift_assignments
      WHERE employee_id = ANY($1) 
        AND assignment_date >= $2::date 
        AND assignment_date <= $3::date
      ORDER BY assignment_date ASC;`,
      [empIds, start, end]
    );

    // 5. Batch query approved leave_requests
    const leavesRes = await pool.query(
      `SELECT 
        lr.id,
        lr.employee_id AS "employeeId",
        TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS "startDate",
        TO_CHAR(COALESCE(lr.end_date, lr.start_date), 'YYYY-MM-DD') AS "endDate",
        lr.is_half_day AS "isHalfDay",
        lr.status,
        COALESCE(lt.name, lr.leave_type_id, 'Leave') AS "leaveName",
        COALESCE(lt.code, 'LV') AS "leaveCode"
      FROM leave_requests lr
      LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ANY($1)
        AND UPPER(lr.status) = 'APPROVED'
        AND lr.start_date <= $3::date 
        AND COALESCE(lr.end_date, lr.start_date) >= $2::date;`,
      [empIds, start, end]
    );

    // 6. Batch query attendance_records
    const attRes = await pool.query(
      `SELECT 
        id,
        employee_id AS "employeeId",
        TO_CHAR(attendance_date, 'YYYY-MM-DD') AS "attendanceDate",
        check_in AS "checkIn",
        check_out AS "checkOut",
        total_hours AS "totalHours",
        status,
        break_duration_minutes AS "breakDurationMinutes",
        overtime_hours AS "overtimeHours",
        is_regularized AS "isRegularized",
        notes
      FROM attendance_records
      WHERE employee_id = ANY($1)
        AND attendance_date >= $2::date
        AND attendance_date <= $3::date;`,
      [empIds, start, end]
    );

    // 7. Note: Company works on US-based calendars where leave is ONLY on Sundays.
    // Indian public holidays are not considered.
    const holidayRes = { rows: [] };
    const holidaysByDate = {};

    days.forEach((day) => {
      day.holiday = null;
    });

    const customShiftsByEmpAndDate = new Map();
    for (const s of shiftRes.rows) {
      customShiftsByEmpAndDate.set(`${s.employeeId}_${s.assignmentDate}`, s);
    }

    const attendanceByEmpAndDate = new Map();
    for (const a of attRes.rows) {
      const totalHoursNum = parseFloat(a.totalHours) || 0;
      let workMinutes = 0;
      if (a.checkIn && a.checkOut) {
        const diffMs = new Date(a.checkOut).getTime() - new Date(a.checkIn).getTime();
        workMinutes = Math.max(0, Math.round(diffMs / 60000) - (parseInt(a.breakDurationMinutes, 10) || 0));
      } else if (totalHoursNum > 0) {
        workMinutes = Math.round(totalHoursNum * 60);
      }

      let formattedWorkHours = '-';
      if (workMinutes > 0) {
        const hrs = Math.floor(workMinutes / 60);
        const mins = workMinutes % 60;
        formattedWorkHours = `${hrs}h ${mins}m`;
      } else if (a.checkIn && !a.checkOut) {
        formattedWorkHours = 'In Progress';
      }

      attendanceByEmpAndDate.set(`${a.employeeId}_${a.attendanceDate}`, {
        id: a.id,
        status: (a.status || 'PRESENT').toUpperCase(),
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        totalHours: totalHoursNum,
        workMinutes,
        formattedWorkHours,
        isRegularized: Boolean(a.isRegularized),
        notes: a.notes || '',
      });
    }

    const leavesByEmp = new Map();
    for (const l of leavesRes.rows) {
      if (!leavesByEmp.has(l.employeeId)) {
        leavesByEmp.set(l.employeeId, []);
      }
      leavesByEmp.get(l.employeeId).push(l);
    }

    // 9. Build each employee row with daily cells and summary stats
    const roster = [];
    const deptSet = new Set();
    let totalOverridesCount = 0;

    for (const emp of eligibleEmployees) {
      if (emp.departmentName) {
        deptSet.add(emp.departmentName);
      }

      const defaultTiming = emp.defaultShiftTiming || '11:00 AM - 07:00 PM';
      const defaultShort = this.getShortShiftLabel(defaultTiming);
      const empLeaves = leavesByEmp.get(emp.id) || [];

      const cells = {};
      let scheduledDaysCount = 0;
      let presentDaysCount = 0;
      let halfDaysCount = 0;
      let overrideDaysCount = 0;
      let leaveDaysCount = 0;
      let weeklyOffDaysCount = 0;
      let totalWorkMinutes = 0;

      for (const day of days) {
        const dateKey = day.dateKey;
        const custom = customShiftsByEmpAndDate.get(`${emp.id}_${dateKey}`) || null;
        const holiday = holidaysByDate[dateKey] || null;
        const leave = empLeaves.find((l) => dateKey >= l.startDate && dateKey <= l.endDate) || null;
        const att = attendanceByEmpAndDate.get(`${emp.id}_${dateKey}`) || null;

        // US-based calendar: ONLY Sundays are Weekly Off. Saturdays are normal working shifts.
        const isSunday = day.dayName === 'Sun' || day.isSunday === true;

        let shiftType = 'SHIFT';
        let shiftLabel = defaultTiming;
        let shortLabel = defaultShort;

        if (isSunday) {
          // Sunday is marked as Week Off for everyone in the monthly schedule roster
          shiftType = 'WO';
          shiftLabel = 'Weekly Off';
          shortLabel = 'WO';
        } else if (custom) {
          shiftType = (custom.shiftType || 'SHIFT').toUpperCase();
          shiftLabel = custom.shiftLabel || (shiftType === 'WO' ? 'Weekly Off' : defaultTiming);
          shortLabel = this.getShortShiftLabel(shiftLabel, custom.shiftStartTime, custom.shiftEndTime);
        }

        // Distinct Half Day detection (excluding HL which is Holiday roster code, not Half Day)
        const isHalfDay = Boolean(
          shiftType !== 'HL' && shiftType !== 'HOLIDAY' && (
            leave?.isHalfDay ||
            leave?.leaveCode === 'HDL' ||
            (leave?.leaveName && leave.leaveName.toLowerCase().includes('half')) ||
            shiftType === 'HD' ||
            /half\s*day/i.test(shiftLabel) ||
            att?.status === 'HALF_DAY'
          )
        );

        // Leave detection (excluding half days, excluding Sunday which is standard Weekly Off)
        const isLeave = Boolean(
          (!isSunday && leave && !isHalfDay) ||
          (['CL', 'PL', 'SL', 'LOP', 'LWP', 'ML', 'PTL', 'SBL'].includes(shiftType)) ||
          (!isSunday && /casual\s*leave|planned\s*leave|sick\s*leave/i.test(shiftLabel)) ||
          (!isSunday && att?.status === 'ON_LEAVE')
        );

        const isWeeklyOff = shiftType === 'WO' || isSunday;

        // Override determination:
        // A day is an override if the custom shift explicitly alters the standard schedule:
        // 1. Off on a weekday (weekday where shiftType === 'WO')
        // 2. Different timing on weekday (weekday working day where shortLabel !== defaultShort)
        let isOverride = false;
        if (custom && !isLeave && !isHalfDay && !isSunday) {
          if (isWeeklyOff) {
            isOverride = true;
          } else if (!isWeeklyOff && shortLabel !== defaultShort) {
            isOverride = true;
          }
        }

        if (isOverride) {
          overrideDaysCount++;
          totalOverridesCount++;
        }

        if (isSunday || isWeeklyOff) {
          weeklyOffDaysCount++;
        } else if (shiftType === 'HL' || shiftType === 'HOLIDAY') {
          // HL roster code counts as Holiday (similar to database holidays)
          // Don't count it as leave or half day
        } else if (isHalfDay) {
          halfDaysCount++;
          scheduledDaysCount += 0.5;
        } else if (isLeave) {
          leaveDaysCount++;
        } else if (shortLabel === 'NA' || shiftType === 'NA') {
          // Unassigned / inactive
        } else {
          scheduledDaysCount++;
        }

        if (att) {
          if (['PRESENT', 'ON_DUTY', 'LATE'].includes(att.status)) {
            presentDaysCount++;
          }
          if (att.workMinutes > 0) {
            totalWorkMinutes += att.workMinutes;
          }
        }

        let displayType = 'SHIFT';
        let cellText = shortLabel;

        if (isSunday || isWeeklyOff) {
          displayType = 'WO';
          cellText = 'WO';
        } else if (holiday) {
          displayType = 'HOLIDAY';
          cellText = 'Holiday';
        } else if (shiftType === 'HL' || shiftType === 'HOLIDAY') {
          // HL = Holiday roster code (distinct from Half Day)
          displayType = 'HOLIDAY';
          cellText = 'HL';
        } else if (isHalfDay) {
          displayType = 'HALF_DAY';
          cellText = 'HD';
        } else if (shortLabel === 'NA' || shiftType === 'NA') {
          displayType = 'NA';
          cellText = 'NA';
        } else if (isLeave) {
          displayType = 'LEAVE';
          cellText = leave?.leaveCode || (['CL', 'PL', 'SL', 'LOP', 'LWP'].includes(shiftType) ? shiftType : 'Leave');
        } else if (isOverride) {
          displayType = 'OVERRIDE';
          cellText = shortLabel;
        }

        cells[dateKey] = {
          dateKey,
          dayNumber: day.dayNumber,
          dayName: day.dayName,
          isWeekend: day.isWeekend,
          isSunday,
          shiftType,
          shiftLabel,
          shortLabel,
          displayType,
          cellText,
          isHalfDay,
          isOverride,
          customAssignment: custom,
          holiday,
          leave,
          attendance: att,
        };
      }

      const totalWorkHoursFormatted = this.formatWorkMinutes(totalWorkMinutes);

      roster.push({
        employee: {
          id: emp.id,
          employeeCode: emp.employeeCode,
          firstName: emp.firstName,
          lastName: emp.lastName,
          fullName: emp.fullName,
          email: emp.email,
          avatarUrl: emp.avatarUrl,
          departmentName: emp.departmentName || 'General',
          departmentId: emp.departmentId || emp.dept_id || '',
          designationTitle: emp.designationTitle || 'Staff',
          defaultShiftTiming: defaultTiming,
        },
        cells,
        stats: {
          scheduledDays: scheduledDaysCount,
          presentDays: presentDaysCount,
          halfDays: halfDaysCount,
          overridesCount: overrideDaysCount,
          leavesDays: leaveDaysCount,
          weeklyOffsCount: weeklyOffDaysCount,
          totalWorkHoursFormatted,
        },
      });
    }

    const result = {
      isAllEmployees: eligibleEmployees.length > 1,
      range: { startDate: start, endDate: end },
      month: m,
      year: y,
      totalEmployees: eligibleEmployees.length,
      days,
      holidaysByDate,
      departments: Array.from(deptSet).sort(),
      roster,
      summary: {
        totalEmployees: eligibleEmployees.length,
        totalOverrides: totalOverridesCount,
        totalAttendancePunches: attRes.rows.length,
        totalApprovedLeaves: leavesRes.rows.length,
        totalHolidays: holidayRes.rows.length,
      },
    };

    if (eligibleEmployees.length === 1) {
      result.employee = eligibleEmployees[0];
      result.defaultShiftTiming = eligibleEmployees[0].defaultShiftTiming;
    }

    return result;
  },

  /**
   * Get shift schedule and monthly roster for employee(s) and date range.
   * Monthly roster is accessible exclusively to HR, Managers, Admin, and CEO.
   */
  async getEmployeeShifts(currentUser, { employeeId, startDate, endDate, month, year, departmentId }) {
    return this.getOrganizationMonthlyRoster(currentUser, { employeeId, startDate, endDate, month, year, departmentId });
  },

  /**
   * Assign or edit shift timings for specific selected dates
   * CRITICAL INVARIANT: The employee's default shift (employees.shift_timing) is NEVER overwritten.
   * Only the selected dates in shift_assignments are modified.
   */
  async assignShiftsForDates(currentUser, { employeeId, dates, shiftType = 'SHIFT', shiftLabel, shiftStartTime, shiftEndTime, notes = '' }) {
    await this.assertCanManageEmployee(currentUser, employeeId);

    if (!Array.isArray(dates) || dates.length === 0) {
      const err = new Error('At least one specific date must be selected to assign shifts.');
      err.statusCode = 400;
      throw err;
    }

    const orgId = currentUser.orgId || 'org-1';
    const userId = currentUser.id || null;

    // Normalize shift parameters
    const normType = (shiftType || 'SHIFT').toUpperCase().trim();
    let normLabel = shiftLabel ? shiftLabel.trim() : null;
    let normStart = shiftStartTime || null;
    let normEnd = shiftEndTime || null;
    let isOvernight = false;

    if (normType === 'WO') {
      normLabel = 'Weekly Off';
      normStart = null;
      normEnd = null;
      isOvernight = false;
    } else {
      if (!normLabel && normStart && normEnd) {
        normLabel = `${normStart.slice(0, 5)} - ${normEnd.slice(0, 5)}`;
      }
      if (normLabel) {
        const parsed = parseShiftTiming(normLabel);
        normStart = `${String(parsed.startHour).padStart(2, '0')}:${String(parsed.startMinute).padStart(2, '0')}:00`;
        normEnd = `${String(parsed.endHour).padStart(2, '0')}:${String(parsed.endMinute).padStart(2, '0')}:00`;
        isOvernight = Boolean(parsed.isOvernight);
      }
    }

    const client = await pool.connect();
    const updatedAssignments = [];

    try {
      await client.query('BEGIN');

      for (const rawDate of dates) {
        const dStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) {
          continue;
        }

        // 1. Read existing assignment if present
        const prevRes = await client.query(
          `SELECT * FROM shift_assignments 
           WHERE employee_id = $1 AND assignment_date = $2::date;`,
          [employeeId, dStr]
        );
        const prev = prevRes.rows[0] || null;
        const assignId = prev ? prev.id : `assign-${nanoid()}`;

        // 2. Upsert shift_assignments for this specific date
        const upsertRes = await client.query(
          `INSERT INTO shift_assignments (
            id, org_id, employee_id, assignment_date, shift_type,
            shift_start_time, shift_end_time, shift_label, is_overnight,
            notes, source, created_by, updated_by, created_at, updated_at
          ) VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, $9, $10, 'MANUAL', $11, $11, NOW(), NOW())
          ON CONFLICT (employee_id, assignment_date)
          DO UPDATE SET
            shift_type = EXCLUDED.shift_type,
            shift_start_time = EXCLUDED.shift_start_time,
            shift_end_time = EXCLUDED.shift_end_time,
            shift_label = EXCLUDED.shift_label,
            is_overnight = EXCLUDED.is_overnight,
            notes = EXCLUDED.notes,
            source = 'MANUAL',
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
          RETURNING *;`,
          [
            assignId,
            orgId,
            employeeId,
            dStr,
            normType,
            normStart,
            normEnd,
            normLabel,
            isOvernight,
            notes || (normType === 'WO' ? 'Weekly Off scheduled' : 'Custom shift timing assigned'),
            userId,
          ]
        );

        const current = upsertRes.rows[0];
        updatedAssignments.push(current);

        // 3. Write audit log
        await client.query(
          `INSERT INTO shift_assignment_audit (
            id, shift_assignment_id, employee_id, assignment_date,
            change_type, old_value, new_value, changed_by, change_source, created_at
          ) VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, 'MANUAL', NOW());`,
          [
            `audit-${nanoid()}`,
            assignId,
            employeeId,
            dStr,
            prev ? 'UPDATED' : 'CREATED',
            prev ? JSON.stringify({
              shiftType: prev.shift_type,
              shiftLabel: prev.shift_label,
              shiftStartTime: prev.shift_start_time,
              shiftEndTime: prev.shift_end_time,
            }) : null,
            JSON.stringify({
              shiftType: normType,
              shiftLabel: normLabel,
              shiftStartTime: normStart,
              shiftEndTime: normEnd,
              notes,
            }),
            userId,
          ]
        );

        // 4. Immediately synchronize with attendance_records for this employee and date
        try {
          if (normType === 'WO') {
            await client.query(
              `UPDATE attendance_records
               SET status = 'WEEKEND', 
                   notes = COALESCE(notes || ' | ', '') || 'Shift updated to Weekly Off (WO)',
                   updated_at = NOW()
               WHERE employee_id = $1 AND attendance_date = $2::date AND status IN ('ABSENT', 'NOT_STARTED');`,
              [employeeId, dStr]
            );
          } else if (normLabel) {
            const attRes = await client.query(
              `SELECT id, check_in, check_out, status, timezone, break_duration_minutes, total_hours
               FROM attendance_records
               WHERE employee_id = $1 AND attendance_date = $2::date;`,
              [employeeId, dStr]
            );
            if (attRes.rows.length > 0) {
              const attRow = attRes.rows[0];
              if (attRow.check_in && !['ON_LEAVE', 'HOLIDAY', 'HALF_DAY'].includes(attRow.status)) {
                const tz = attRow.timezone || 'Asia/Kolkata';
                const evaluatedStatus = determineAttendanceStatus(new Date(attRow.check_in), normLabel, tz, 5);
                let evaluatedHours = parseFloat(attRow.total_hours) || 0;
                let evaluatedOT = 0;
                if (attRow.check_out) {
                  const recalc = calculateWorkingHoursAndOvertime({
                    checkIn: attRow.check_in,
                    checkOut: attRow.check_out,
                    breakDurationMinutes: attRow.break_duration_minutes,
                    shiftTiming: normLabel,
                  });
                  evaluatedHours = recalc.totalHours;
                  evaluatedOT = recalc.overtimeHours;
                }
                await client.query(
                  `UPDATE attendance_records
                   SET status = $1,
                       total_hours = $2,
                       overtime_hours = $3,
                       notes = COALESCE(notes || ' | ', '') || '[SHIFT_UPDATED: ' || $4 || ']',
                       updated_at = NOW()
                   WHERE id = $5;`,
                  [evaluatedStatus, evaluatedHours, evaluatedOT, normLabel, attRow.id]
                );
              }
            }
          }
        } catch (attSyncErr) {
          logger.warn('SHIFT_MANAGEMENT', `Attendance re-sync skipped for ${employeeId} on ${dStr}: ${attSyncErr.message}`);
        }
      }

      await client.query('COMMIT');

      logger.info('SHIFT_MANAGEMENT', `Assigned shift "${normLabel || normType}" to employee ${employeeId} for ${dates.length} date(s) by user ${userId}`);

      return {
        message: `Successfully updated shift timing for ${updatedAssignments.length} selected date(s).`,
        count: updatedAssignments.length,
        dates,
        shiftLabel: normLabel || normType,
        shiftType: normType,
        assignments: updatedAssignments,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Reset specific dates back to the employee's default shift
   * Removes rows from shift_assignments so the employee falls back naturally to default contract shift
   */
  async resetShiftsToDefault(currentUser, { employeeId, dates }) {
    await this.assertCanManageEmployee(currentUser, employeeId);

    if (!Array.isArray(dates) || dates.length === 0) {
      const err = new Error('Please select at least one date to reset back to default shift.');
      err.statusCode = 400;
      throw err;
    }

    const client = await pool.connect();
    const userId = currentUser.id || null;
    let resetCount = 0;

    try {
      await client.query('BEGIN');

      for (const rawDate of dates) {
        const dStr = typeof rawDate === 'string' ? rawDate.slice(0, 10) : '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(dStr)) continue;

        const prevRes = await client.query(
          `SELECT * FROM shift_assignments 
           WHERE employee_id = $1 AND assignment_date = $2::date;`,
          [employeeId, dStr]
        );

        if (prevRes.rows.length > 0) {
          const prev = prevRes.rows[0];
          await client.query(
            `DELETE FROM shift_assignments WHERE id = $1;`,
            [prev.id]
          );

          await client.query(
            `INSERT INTO shift_assignment_audit (
              id, shift_assignment_id, employee_id, assignment_date,
              change_type, old_value, new_value, changed_by, change_source, created_at
            ) VALUES ($1, $2, $3, $4::date, 'DELETED', $5, $6, $7, 'MANUAL', NOW());`,
            [
              `audit-${nanoid()}`,
              prev.id,
              employeeId,
              dStr,
              JSON.stringify({
                shiftType: prev.shift_type,
                shiftLabel: prev.shift_label,
                shiftStartTime: prev.shift_start_time,
                shiftEndTime: prev.shift_end_time,
              }),
              JSON.stringify({ note: 'Reverted to employee default shift' }),
              userId,
            ]
          );

          resetCount++;

          // Re-evaluate existing attendance record against employee's contract default shift
          try {
            const empRes = await client.query('SELECT shift_timing FROM employees WHERE id = $1', [employeeId]);
            const defaultShift = empRes.rows[0]?.shift_timing || '11:00 AM - 07:00 PM';
            const attRes = await client.query(
              `SELECT id, check_in, check_out, status, timezone, break_duration_minutes, total_hours
               FROM attendance_records
               WHERE employee_id = $1 AND attendance_date = $2::date;`,
              [employeeId, dStr]
            );
            if (attRes.rows.length > 0 && attRes.rows[0].check_in) {
              const attRow = attRes.rows[0];
              const tz = attRow.timezone || 'Asia/Kolkata';
              const evaluatedStatus = determineAttendanceStatus(new Date(attRow.check_in), defaultShift, tz, 5);
              let evaluatedHours = parseFloat(attRow.total_hours) || 0;
              let evaluatedOT = 0;
              if (attRow.check_out) {
                const recalc = calculateWorkingHoursAndOvertime({
                  checkIn: attRow.check_in,
                  checkOut: attRow.check_out,
                  breakDurationMinutes: attRow.break_duration_minutes,
                  shiftTiming: defaultShift,
                });
                evaluatedHours = recalc.totalHours;
                evaluatedOT = recalc.overtimeHours;
              }
              await client.query(
                `UPDATE attendance_records
                 SET status = $1, total_hours = $2, overtime_hours = $3, notes = COALESCE(notes || ' | ', '') || '[REVERTED_DEFAULT_SHIFT]', updated_at = NOW()
                 WHERE id = $4;`,
                [evaluatedStatus, evaluatedHours, evaluatedOT, attRow.id]
              );
            }
          } catch (rSyncErr) {
            logger.warn('SHIFT_MANAGEMENT', `Attendance re-sync on reset skipped: ${rSyncErr.message}`);
          }
        }
      }

      await client.query('COMMIT');

      return {
        message: `Reset ${resetCount} date(s) back to standard default shift timing.`,
        resetCount,
        dates,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Get shift change audit trail
   */
  async getAuditHistory(currentUser, { employeeId, limit = 50, offset = 0 } = {}) {
    const orgId = currentUser.orgId || 'org-1';
    const isHrAdmin = this.isHrOrAdmin(currentUser);

    const conditions = ['e.org_id = $1'];
    const params = [orgId];
    let pIdx = 2;

    if (employeeId) {
      conditions.push(`sa.employee_id = $${pIdx++}`);
      params.push(employeeId);
    } else if (!isHrAdmin) {
      // Manager: restricted to their team
      const callerEmp = await this.resolveCallerEmployee(currentUser);
      if (!callerEmp) return { history: [], total: 0 };
      conditions.push(`e.manager_id = $${pIdx++}`);
      params.push(callerEmp.id);
    }

    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await pool.query(
      `SELECT count(*)::int AS total 
       FROM shift_assignment_audit sa
       JOIN employees e ON e.id = sa.employee_id
       ${whereSql};`,
      params
    );
    const total = countRes.rows[0]?.total || 0;

    const querySql = `
      SELECT 
        sa.id,
        sa.shift_assignment_id AS "shiftAssignmentId",
        sa.employee_id AS "employeeId",
        sa.assignment_date AS "assignmentDate",
        sa.change_type AS "changeType",
        sa.old_value AS "oldValue",
        sa.new_value AS "newValue",
        sa.change_source AS "changeSource",
        sa.created_at AS "createdAt",
        TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "employeeName",
        e.employee_code AS "employeeCode",
        e.shift_timing AS "defaultShiftTiming",
        u.first_name || ' ' || COALESCE(u.last_name, '') AS "changedByName",
        r.name AS "changedByRole"
      FROM shift_assignment_audit sa
      JOIN employees e ON e.id = sa.employee_id
      LEFT JOIN users u ON u.id = sa.changed_by
      LEFT JOIN roles r ON r.id = u.role_id
      ${whereSql}
      ORDER BY sa.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;

    const listRes = await pool.query(querySql, [...params, limit, offset]);

    return {
      history: listRes.rows,
      total,
      limit,
      offset,
    };
  },
};

export default shiftManagementService;
