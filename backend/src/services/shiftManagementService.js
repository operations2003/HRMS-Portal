import { pool } from '../config/db.js';
import { parseShiftTiming } from '../utils/shiftUtils.js';
import { logger } from '../utils/logger.js';
import { nanoid } from 'nanoid';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const shiftManagementService = {
  /**
   * Check if caller is HR or Admin or authorized HR Operations personnel
   */
  isHrOrAdmin(user) {
    if (!user) return false;
    const role = normalizeRole(user?.roleName || user?.role?.name || user?.role || '');
    if (['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager', 'management'].includes(role)) {
      return true;
    }

    const allRoles = (Array.isArray(user?.roles) ? user.roles : [user?.roleName || user?.role || ''])
      .filter(Boolean)
      .map(normalizeRole);
    if (allRoles.some((r) => ['admin', 'superadmin', 'orgadmin', 'hr', 'hrmanager'].some((adm) => r.includes(adm)))) {
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
    if (role.includes('manager') || role === 'teamlead') return true;

    const allRoles = (Array.isArray(user?.roles) ? user.roles : [user?.roleName || user?.role || ''])
      .filter(Boolean)
      .map(normalizeRole);
    return allRoles.some((r) => r.includes('manager') || r === 'teamlead');
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
    if (this.isHrOrAdmin(currentUser)) {
      return true;
    }

    const callerEmp = await this.resolveCallerEmployee(currentUser);
    if (!callerEmp) {
      const err = new Error('Access denied: No employee profile found for your account.');
      err.statusCode = 403;
      throw err;
    }

    // Check if target is in caller's direct team or department
    const targetRes = await pool.query(
      `SELECT id, manager_id, dept_id, org_id FROM employees WHERE id = $1;`,
      [targetEmployeeId]
    );

    if (targetRes.rows.length === 0) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }

    const target = targetRes.rows[0];
    const isDirectReport = target.manager_id === callerEmp.id;
    const isManagerRole = this.isManager(currentUser);
    const isDeptManager = isManagerRole && callerEmp.dept_id && target.dept_id === callerEmp.dept_id;

    if (isDirectReport || isDeptManager) {
      return true;
    }

    const err = new Error('Access denied: You are not authorized to modify shifts for this employee.');
    err.statusCode = 403;
    throw err;
  },

  /**
   * Get eligible employees for shift management
   * - HR/Admin/Operations: All active employees in organization
   * - Manager: Direct reports, department members, and self
   * - Employee: Only their own profile
   */
  async getEligibleEmployees(currentUser) {
    const orgId = currentUser.orgId || 'org-1';

    if (this.isHrOrAdmin(currentUser)) {
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
          ds.title AS "designationTitle",
          e.manager_id AS "managerId",
          (SELECT COUNT(*)::int FROM shift_assignments sa WHERE sa.employee_id = e.id AND sa.assignment_date >= DATE_TRUNC('month', CURRENT_DATE) AND sa.assignment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') AS "customShiftCount"
        FROM employees e
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN departments d ON d.id = e.dept_id
        LEFT JOIN designations ds ON ds.id = e.desig_id
        WHERE (e.org_id = $1 OR e.org_id IS NULL OR $1 = '')
          AND (e.status IS NULL OR LOWER(e.status) NOT IN ('exited', 'terminated', 'inactive', 'suspended', 'archived'))
        ORDER BY e.first_name ASC, e.last_name ASC;`,
        [orgId]
      );
      return res.rows;
    }

    const callerEmp = await this.resolveCallerEmployee(currentUser);
    if (!callerEmp) {
      return [];
    }

    // Regular Employee: Strictly their own profile
    if (!this.isManager(currentUser)) {
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
    }

    // Manager / Team Lead / Supervisor: Direct reports, department members, and themselves
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
        ds.title AS "designationTitle",
        e.manager_id AS "managerId",
        (SELECT COUNT(*)::int FROM shift_assignments sa WHERE sa.employee_id = e.id AND sa.assignment_date >= DATE_TRUNC('month', CURRENT_DATE) AND sa.assignment_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') AS "customShiftCount"
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN departments d ON d.id = e.dept_id
      LEFT JOIN designations ds ON ds.id = e.desig_id
      WHERE (e.org_id = $1 OR e.org_id IS NULL OR $1 = '')
        AND (e.id = $2 OR e.manager_id = $2 OR (callerEmp.dept_id IS NOT NULL AND e.dept_id = $3))
        AND (e.status IS NULL OR LOWER(e.status) NOT IN ('exited', 'terminated', 'inactive', 'suspended', 'archived'))
      ORDER BY e.first_name ASC, e.last_name ASC;`,
      [orgId, callerEmp.id, callerEmp.dept_id || '']
    );

    return res.rows;
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
  getShortShiftLabel(label) {
    if (!label) return '-';
    const clean = label.trim();
    if (/^wo\b|weekly\s*off/i.test(clean)) return 'WO';
    const match = clean.match(/(\d{1,2})(?::\d{2})?\s*(?:am|pm)?\s*[-–—to]+\s*(\d{1,2})(?::\d{2})?\s*(?:am|pm)?/i);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
    return clean.length > 8 ? clean.slice(0, 8) : clean;
  },

  /**
   * Get organization-wide or team monthly roster in rows (employees) and columns (days 1..N)
   * Designed specifically for Admin, HR, and Managers to view all employees together.
   */
  async getOrganizationMonthlyRoster(currentUser, { month, year, startDate, endDate, departmentId }) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const isMgr = this.isManager(currentUser);

    if (!isHrAdmin && !isMgr) {
      const err = new Error('Access denied: Only HR, Admin, or authorized Managers can view the organization roster.');
      err.statusCode = 403;
      throw err;
    }

    const orgId = currentUser.orgId || 'org-1';

    // 1. Fetch eligible employees for this caller
    let eligibleEmployees = await this.getEligibleEmployees(currentUser);

    // Optional department filtering
    if (departmentId && departmentId !== 'ALL' && departmentId !== '') {
      eligibleEmployees = eligibleEmployees.filter(
        (e) => (e.departmentId === departmentId || e.departmentName === departmentId || e.dept_id === departmentId)
      );
    }

    // 2. Compute date range
    const y = year ? parseInt(year, 10) : new Date().getFullYear();
    const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
    const mStr = String(m).padStart(2, '0');
    const start = startDate || `${y}-${mStr}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const end = endDate || `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;

    // 3. Generate columns metadata for each day of the month
    const days = [];
    const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let d = 1; d <= lastDay; d++) {
      const dStr = String(d).padStart(2, '0');
      const dateKey = `${y}-${mStr}-${dStr}`;
      const dateObj = new Date(y, m - 1, d);
      const dayOfWeek = dateObj.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      days.push({
        dayNumber: d,
        dateKey,
        dayName: weekdayNames[dayOfWeek],
        isWeekend,
      });
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
        TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS "endDate",
        lr.is_half_day AS "isHalfDay",
        lr.status,
        lt.name AS "leaveName",
        lt.code AS "leaveCode"
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = ANY($1)
        AND lr.status = 'APPROVED'
        AND lr.start_date <= $3::date 
        AND lr.end_date >= $2::date;`,
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

    // 7. Query org holidays
    const holidayRes = await pool.query(
      `SELECT 
        id,
        TO_CHAR(holiday_date, 'YYYY-MM-DD') AS "holidayDate",
        name,
        is_optional AS "isOptional"
      FROM holidays
      WHERE (org_id = $1 OR org_id IS NULL OR $1 = '')
        AND (status = 'Active' OR status IS NULL)
        AND holiday_date >= $2::date
        AND holiday_date <= $3::date;`,
      [orgId, start, end]
    );

    // 8. Map lookups
    const holidaysByDate = {};
    for (const h of holidayRes.rows) {
      holidaysByDate[h.holidayDate] = h;
    }

    days.forEach((day) => {
      day.holiday = holidaysByDate[day.dateKey] || null;
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

        const isOverride = Boolean(custom);
        if (isOverride) {
          overrideDaysCount++;
          totalOverridesCount++;
        }

        let shiftType = 'SHIFT';
        let shiftLabel = defaultTiming;
        let shortLabel = defaultShort;

        if (custom) {
          shiftType = custom.shiftType || 'SHIFT';
          shiftLabel = custom.shiftLabel || (shiftType === 'WO' ? 'Weekly Off' : defaultTiming);
          shortLabel = shiftType === 'WO' ? 'WO' : this.getShortShiftLabel(shiftLabel);
        } else if (day.isWeekend) {
          shiftType = 'WO';
          shiftLabel = 'Weekly Off';
          shortLabel = 'WO';
        }

        if (shiftType === 'WO') {
          weeklyOffDaysCount++;
        } else {
          scheduledDaysCount++;
        }

        // Distinct Half Day detection:
        // Do not classify Half Days as Planned Leave (PL)!
        const isHalfDay = Boolean(
          leave?.isHalfDay ||
          leave?.leaveCode === 'HDL' ||
          (leave?.leaveName && leave.leaveName.toLowerCase().includes('half')) ||
          att?.status === 'HALF_DAY'
        );

        if (isHalfDay) {
          halfDaysCount++;
        } else if (leave) {
          leaveDaysCount++;
        }

        if (att) {
          if (['PRESENT', 'ON_DUTY'].includes(att.status)) {
            presentDaysCount++;
          }
          if (att.workMinutes > 0) {
            totalWorkMinutes += att.workMinutes;
          }
        }

        let displayType = 'SHIFT';
        let cellText = shortLabel;

        if (holiday) {
          displayType = 'HOLIDAY';
          cellText = 'Holiday';
        } else if (isHalfDay) {
          // Half day must strictly be Half Day, NEVER Planned Leave (PL)
          displayType = 'HALF_DAY';
          cellText = 'Half Day';
        } else if (leave) {
          displayType = 'LEAVE';
          // Full-day leave according to type: PL = Planned Leave, CL = Casual Leave, SL = Sick Leave, etc.
          cellText = leave.leaveCode || leave.leaveName || 'Leave';
        } else if (shiftType === 'WO') {
          displayType = 'WO';
          cellText = 'WO';
        } else if (isOverride) {
          displayType = 'OVERRIDE';
          cellText = shortLabel;
        }

        cells[dateKey] = {
          dateKey,
          dayNumber: day.dayNumber,
          dayName: day.dayName,
          isWeekend: day.isWeekend,
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

    return {
      isAllEmployees: true,
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
  },

  /**
   * Get shift schedule for a specific employee and date range
   */
  async getEmployeeShifts(currentUser, { employeeId, startDate, endDate, month, year, departmentId }) {
    if (employeeId === 'ALL' || employeeId === 'all') {
      return this.getOrganizationMonthlyRoster(currentUser, { startDate, endDate, month, year, departmentId });
    }

    const orgId = currentUser.orgId || 'org-1';

    // Fall back to caller employee if not specified
    let targetEmpId = employeeId;
    if (!targetEmpId) {
      const callerEmp = await this.resolveCallerEmployee(currentUser);
      targetEmpId = callerEmp?.id;
    }

    if (!targetEmpId) {
      const err = new Error('Employee ID is required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify view permission
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    if (!isHrAdmin) {
      const callerEmp = await this.resolveCallerEmployee(currentUser);
      if (callerEmp && callerEmp.id !== targetEmpId) {
        // Must be direct report or department member if manager
        const checkRes = await pool.query(
          `SELECT manager_id, dept_id FROM employees WHERE id = $1;`,
          [targetEmpId]
        );
        const target = checkRes.rows[0];
        const isManager = this.isManager(currentUser);
        const isAuthorized = target && (
          target.manager_id === callerEmp.id || 
          (isManager && callerEmp.dept_id && target.dept_id === callerEmp.dept_id)
        );

        if (!isAuthorized) {
          const err = new Error('Access denied: You are not authorized to view this employee schedule.');
          err.statusCode = 403;
          throw err;
        }
      }
    }

    // Fetch target employee profile
    const empRes = await pool.query(
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
        ds.title AS "designationTitle"
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN departments d ON d.id = e.dept_id
      LEFT JOIN designations ds ON ds.id = e.desig_id
      WHERE e.id = $1 AND (e.org_id = $2 OR e.org_id IS NULL OR $2 = '');`,
      [targetEmpId, orgId]
    );

    if (empRes.rows.length === 0) {
      const err = new Error('Employee not found.');
      err.statusCode = 404;
      throw err;
    }

    const employee = empRes.rows[0];

    // Compute range
    let start = startDate;
    let end = endDate;

    if (!start || !end) {
      const y = year ? parseInt(year, 10) : new Date().getFullYear();
      const m = month ? parseInt(month, 10) : new Date().getMonth() + 1;
      const mStr = String(m).padStart(2, '0');
      start = `${y}-${mStr}-01`;
      const lastDay = new Date(y, m, 0).getDate();
      end = `${y}-${mStr}-${String(lastDay).padStart(2, '0')}`;
    }

    // 1. Fetch custom shift assignments
    const shiftRes = await pool.query(
      `SELECT 
        id,
        assignment_date AS "assignmentDate",
        shift_type AS "shiftType",
        shift_start_time AS "shiftStartTime",
        shift_end_time AS "shiftEndTime",
        shift_label AS "shiftLabel",
        is_overnight AS "isOvernight",
        notes,
        source,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM shift_assignments
      WHERE employee_id = $1 
        AND assignment_date >= $2::date 
        AND assignment_date <= $3::date
      ORDER BY assignment_date ASC;`,
      [targetEmpId, start, end]
    );

    // 2. Fetch approved leaves in this range
    const leavesRes = await pool.query(
      `SELECT 
        lr.id,
        lr.start_date AS "startDate",
        lr.end_date AS "endDate",
        lr.is_half_day AS "isHalfDay",
        lr.status,
        lt.name AS "leaveName",
        lt.code AS "leaveCode"
      FROM leave_requests lr
      JOIN leave_types lt ON lt.id = lr.leave_type_id
      WHERE lr.employee_id = $1
        AND lr.status = 'APPROVED'
        AND lr.start_date <= $3::date 
        AND lr.end_date >= $2::date;`,
      [targetEmpId, start, end]
    );

    // 3. Fetch org holidays in this range
    const holidayRes = await pool.query(
      `SELECT 
        id,
        holiday_date AS "holidayDate",
        name,
        is_optional AS "isOptional"
      FROM holidays
      WHERE (org_id = $1 OR org_id IS NULL OR $1 = '')
        AND (status = 'Active' OR status IS NULL)
        AND holiday_date >= $2::date
        AND holiday_date <= $3::date;`,
      [orgId, start, end]
    );

    // 4. Fetch actual attendance records in this range
    const attRes = await pool.query(
      `SELECT 
        id,
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
      WHERE employee_id = $1
        AND attendance_date >= $2::date
        AND attendance_date <= $3::date
      ORDER BY attendance_date ASC;`,
      [targetEmpId, start, end]
    );

    const customShiftsByDate = {};
    for (const s of shiftRes.rows) {
      const dStr = typeof s.assignmentDate === 'string' 
        ? s.assignmentDate.slice(0, 10) 
        : new Date(s.assignmentDate).toISOString().slice(0, 10);
      customShiftsByDate[dStr] = s;
    }

    const holidaysByDate = {};
    for (const h of holidayRes.rows) {
      const dStr = typeof h.holidayDate === 'string'
        ? h.holidayDate.slice(0, 10)
        : new Date(h.holidayDate).toISOString().slice(0, 10);
      holidaysByDate[dStr] = h;
    }

    const attendanceByDate = {};
    for (const a of attRes.rows) {
      const dStr = a.attendanceDate;
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
      } else if (['ABSENT', 'NOT_STARTED'].includes((a.status || '').toUpperCase())) {
        formattedWorkHours = '0h 0m';
      }

      attendanceByDate[dStr] = {
        id: a.id,
        attendanceDate: dStr,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        totalHours: totalHoursNum,
        workMinutes,
        formattedWorkHours,
        status: (a.status || 'PRESENT').toUpperCase(),
        breakDurationMinutes: parseInt(a.breakDurationMinutes, 10) || 0,
        overtimeHours: parseFloat(a.overtimeHours) || 0,
        isRegularized: Boolean(a.isRegularized),
        notes: a.notes || '',
      };
    }

    return {
      employee,
      range: { startDate: start, endDate: end },
      defaultShiftTiming: employee.defaultShiftTiming || '11:00 AM - 07:00 PM',
      customAssignments: shiftRes.rows,
      customShiftsByDate,
      holidaysByDate,
      approvedLeaves: leavesRes.rows,
      attendanceByDate,
      attendanceRecords: attRes.rows,
    };
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
