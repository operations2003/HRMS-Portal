import { employeeRepository } from '../repositories/employeeRepository.js';
import { leaveRepository } from '../repositories/leaveRepository.js';
import { attendanceRepository } from '../repositories/attendanceRepository.js';
import { performanceRepository } from '../repositories/performanceRepository.js';
import { notificationService } from './notificationService.js';
import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { validateEmployeeId } from '../validators/managerValidator.js';

export const managerService = {
  /**
   * Helper: Check if current user possesses HR or Admin privileges
   */
  isHrOrAdmin(currentUser) {
    const role = (currentUser.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(role);
  },

  /**
   * Helper: Resolve current user's employee record as a manager
   */
  async resolveManagerEmployee(currentUser) {
    if (!currentUser || !currentUser.id) return null;

    // 1. Try finding by user_id
    let emp = await employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
    if (emp) return emp;

    // 2. Fall back to email
    if (currentUser.email) {
      emp = await employeeRepository.findByEmail(currentUser.email, currentUser.orgId);
      if (emp) return emp;
    }

    // 3. Fall back across org if superadmin
    if (currentUser.email && this.isHrOrAdmin(currentUser)) {
      emp = await employeeRepository.findByEmail(currentUser.email);
      if (emp) return emp;
    }

    return null;
  },

  /**
   * SECURITY ENFORCEMENT: Validate team scope
   * Ensures that the requested employeeId belongs to the manager's authorized direct team.
   */
  async assertTeamScope(currentUser, employeeId) {
    const idError = validateEmployeeId(employeeId);
    if (idError) {
      const err = new Error(idError);
      err.statusCode = 400;
      throw err;
    }

    const cleanId = employeeId.trim();
    const isHrAdmin = this.isHrOrAdmin(currentUser);

    // Fetch target employee
    const targetEmp = await employeeRepository.findById(cleanId);
    if (!targetEmp) {
      const err = new Error(`Employee with ID '${cleanId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Organization boundary check
    if (targetEmp.orgId !== currentUser.orgId && !isHrAdmin) {
      const err = new Error('Access denied: Employee not found in your organization.');
      err.statusCode = 404;
      throw err;
    }

    // Team scope boundary check
    if (!isHrAdmin) {
      const managerEmp = await this.resolveManagerEmployee(currentUser);
      if (!managerEmp) {
        const err = new Error('Access denied: No employee profile associated with your manager account.');
        err.statusCode = 403;
        throw err;
      }

      if (targetEmp.managerId !== managerEmp.id) {
        const err = new Error('Access denied: This employee is not assigned to your authorized team.');
        err.statusCode = 403;
        throw err;
      }
    }

    return targetEmp;
  },

  // =========================================================================
  // 1. Manager Profile / Dashboard Data
  // =========================================================================

  async getManagerDashboard(currentUser) {
    const managerEmp = await this.resolveManagerEmployee(currentUser);
    const isHrAdmin = this.isHrOrAdmin(currentUser);

    const managerProfile = managerEmp
      ? {
          id: managerEmp.id,
          employeeCode: managerEmp.employeeCode,
          firstName: managerEmp.firstName,
          lastName: managerEmp.lastName,
          fullName: `${managerEmp.firstName || ''} ${managerEmp.lastName || ''}`.trim(),
          email: managerEmp.email,
          phone: managerEmp.phone,
          department: managerEmp.department?.name || '',
          designation: managerEmp.designation?.title || '',
          shiftTiming: managerEmp.shiftTiming || '11:00 AM - 07:00 PM',
          employmentType: managerEmp.employmentType || 'Full-Time',
          status: managerEmp.status,
          dateOfJoining: managerEmp.dateOfJoining,
        }
      : {
          id: null,
          fullName: `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || 'System Administrator',
          email: currentUser.email,
          role: currentUser.roleName,
          status: 'Active',
        };

    const targetManagerId = managerEmp?.id || null;
    const todayStr = new Date().toISOString().split('T')[0];

    // Aggregated team statistics
    let teamSummary = {
      totalMembers: 0,
      activeMembers: 0,
      onLeaveToday: 0,
      presentToday: 0,
      lateToday: 0,
      absentToday: 0,
    };

    let pendingApprovals = {
      pendingLeaves: 0,
      pendingAppraisals: 0,
      totalPending: 0,
    };

    if (targetManagerId) {
      const summaryQuery = `
        SELECT 
          COUNT(e.id)::int AS "totalMembers",
          COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'active')::int AS "activeMembers",
          COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'on leave')::int AS "onLeaveToday",
          COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('PRESENT', 'HALF_DAY'))::int AS "presentToday",
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'LATE')::int AS "lateToday"
        FROM employees e
        LEFT JOIN attendance_records a 
          ON a.employee_id = e.id 
          AND a.attendance_date = $2
        WHERE e.manager_id = $1 AND e.org_id = $3;
      `;
      const res = await pool.query(summaryQuery, [targetManagerId, todayStr, currentUser.orgId]);
      const row = res.rows[0] || {};
      const totalMembers = row.totalMembers || 0;
      const presentToday = row.presentToday || 0;
      const lateToday = row.lateToday || 0;

      // On leave today based on approved leave requests spanning today
      const leaveTodayRes = await pool.query(
        `SELECT COUNT(DISTINCT lr.employee_id)::int AS "onLeaveToday"
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         WHERE e.manager_id = $1 AND lr.status = 'APPROVED'
           AND lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE;`,
        [targetManagerId]
      );
      const onLeaveToday = leaveTodayRes.rows[0]?.onLeaveToday || 0;

      teamSummary = {
        totalMembers,
        activeMembers: row.activeMembers || 0,
        onLeaveToday,
        presentToday,
        lateToday,
        absentToday: Math.max(0, totalMembers - presentToday - lateToday - onLeaveToday),
      };

      // Pending leaves
      const leaveRes = await pool.query(
        `SELECT COUNT(lr.id)::int AS "pendingLeaves"
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         WHERE e.manager_id = $1 AND lr.status = 'PENDING';`,
        [targetManagerId]
      );
      const pendingLeaves = leaveRes.rows[0]?.pendingLeaves || 0;

      // Pending performance appraisals
      const perfRes = await pool.query(
        `SELECT COUNT(pr.id)::int AS "pendingAppraisals"
         FROM performance_records pr
         JOIN employees e ON pr.employee_id = e.id
         WHERE (e.manager_id = $1 OR pr.reviewer_id = $1)
           AND pr.status IN ('SUBMITTED', 'UNDER_REVIEW');`,
        [targetManagerId]
      );
      const pendingAppraisals = perfRes.rows[0]?.pendingAppraisals || 0;

      pendingApprovals = {
        pendingLeaves,
        pendingAppraisals,
        totalPending: pendingLeaves + pendingAppraisals,
      };
    } else if (isHrAdmin) {
      // HR/Admin organization metrics
      const orgRes = await pool.query(
        `SELECT 
          COUNT(*)::int AS "totalMembers",
          COUNT(*) FILTER (WHERE LOWER(status) = 'active')::int AS "activeMembers"
         FROM employees WHERE org_id = $1;`,
        [currentUser.orgId]
      );
      const leaveTodayRes = await pool.query(
        `SELECT COUNT(DISTINCT lr.employee_id)::int AS "onLeaveToday"
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         WHERE e.org_id = $1 AND lr.status = 'APPROVED'
           AND lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE;`,
        [currentUser.orgId]
      );
      const row = orgRes.rows[0] || {};
      const onLeaveToday = leaveTodayRes.rows[0]?.onLeaveToday || 0;
      teamSummary = {
        totalMembers: row.totalMembers || 0,
        activeMembers: row.activeMembers || 0,
        onLeaveToday,
        presentToday: 0,
        lateToday: 0,
        absentToday: 0,
      };
    }

    return {
      manager: managerProfile,
      teamSummary,
      pendingApprovals,
      quickStats: {
        attendanceRate:
          teamSummary.totalMembers > 0
            ? parseFloat((((teamSummary.presentToday + teamSummary.lateToday) / teamSummary.totalMembers) * 100).toFixed(1))
            : 0.0,
      },
      lastRefreshedAt: new Date().toISOString(),
    };
  },

  // =========================================================================
  // 2. Assigned Team Members
  // =========================================================================

  async getTeamMembers(currentUser, { search = '', departmentId = '', status = '', managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    if (!targetManagerId || !isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) {
        if (isHrAdmin) return [];
        const err = new Error('No employee profile associated with your manager account.');
        err.statusCode = 404;
        throw err;
      }
      targetManagerId = emp.id;
    }

    let members = await employeeRepository.findDirectReports(targetManagerId, currentUser.orgId);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      members = members.filter(
        (m) =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.employeeCode.toLowerCase().includes(q)
      );
    }

    if (departmentId && departmentId.trim()) {
      members = members.filter((m) => m.deptId === departmentId.trim());
    }

    if (status && status.trim()) {
      members = members.filter((m) => m.status.toLowerCase() === status.trim().toLowerCase());
    }

    return members;
  },

  async getTeamMemberById(currentUser, employeeId) {
    const targetEmp = await this.assertTeamScope(currentUser, employeeId);

    // Fetch quick summary stats for this team member
    const [attRes, leaveRes] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*)::int AS "totalMarked",
          COUNT(*) FILTER (WHERE status = 'PRESENT')::int AS "presentCount",
          COUNT(*) FILTER (WHERE status = 'LATE')::int AS "lateCount"
         FROM attendance_records
         WHERE employee_id = $1 AND attendance_date >= CURRENT_DATE - INTERVAL '30 days';`,
        [targetEmp.id]
      ),
      pool.query(
        `SELECT 
          COUNT(*)::int AS "totalApplied",
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS "pendingCount",
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS "approvedCount"
         FROM leave_requests
         WHERE employee_id = $1;`,
        [targetEmp.id]
      ),
    ]);

    const attRow = attRes.rows[0] || {};
    const leaveRow = leaveRes.rows[0] || {};

    return {
      ...targetEmp,
      metrics: {
        last30DaysAttendance: {
          totalMarked: attRow.totalMarked || 0,
          presentCount: attRow.presentCount || 0,
          lateCount: attRow.lateCount || 0,
        },
        leaves: {
          totalApplied: leaveRow.totalApplied || 0,
          pendingCount: leaveRow.pendingCount || 0,
          approvedCount: leaveRow.approvedCount || 0,
        },
      },
    };
  },

  // =========================================================================
  // 3. Team Employee Summary
  // =========================================================================

  async getTeamSummary(currentUser, { managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    if (!targetManagerId || !isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) {
        return {
          totalMembers: 0,
          activeMembers: 0,
          onLeaveToday: 0,
          presentToday: 0,
          lateToday: 0,
          absentToday: 0,
          pendingLeaveApprovals: 0,
          pendingAppraisals: 0,
          departmentBreakdown: [],
        };
      }
      targetManagerId = emp.id;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const [summaryRes, deptRes, leaveRes, perfRes] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(e.id)::int AS "totalMembers",
          COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'active')::int AS "activeMembers",
          COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'on leave')::int AS "onLeaveToday",
          COUNT(DISTINCT a.id) FILTER (WHERE a.status IN ('PRESENT', 'HALF_DAY'))::int AS "presentToday",
          COUNT(DISTINCT a.id) FILTER (WHERE a.status = 'LATE')::int AS "lateToday"
        FROM employees e
        LEFT JOIN attendance_records a 
          ON a.employee_id = e.id 
          AND a.attendance_date = $2
        WHERE e.manager_id = $1 AND e.org_id = $3;`,
        [targetManagerId, todayStr, currentUser.orgId]
      ),
      pool.query(
        `SELECT 
          d.id AS "departmentId",
          d.name AS "departmentName",
          COUNT(e.id)::int AS "count"
        FROM employees e
        LEFT JOIN departments d ON e.dept_id = d.id
        WHERE e.manager_id = $1 AND e.org_id = $2
        GROUP BY d.id, d.name
        ORDER BY "count" DESC;`,
        [targetManagerId, currentUser.orgId]
      ),
      pool.query(
        `SELECT COUNT(lr.id)::int AS "pendingLeaves"
         FROM leave_requests lr
         JOIN employees e ON lr.employee_id = e.id
         WHERE e.manager_id = $1 AND lr.status = 'PENDING';`,
        [targetManagerId]
      ),
      pool.query(
        `SELECT COUNT(pr.id)::int AS "pendingAppraisals"
         FROM performance_records pr
         JOIN employees e ON pr.employee_id = e.id
         WHERE (e.manager_id = $1 OR pr.reviewer_id = $1)
           AND pr.status IN ('SUBMITTED', 'UNDER_REVIEW');`,
        [targetManagerId]
      ),
    ]);

    const row = summaryRes.rows[0] || {};
    const totalMembers = row.totalMembers || 0;
    const presentToday = row.presentToday || 0;
    const lateToday = row.lateToday || 0;
    const onLeaveToday = row.onLeaveToday || 0;

    return {
      totalMembers,
      activeMembers: row.activeMembers || 0,
      onLeaveToday,
      presentToday,
      lateToday,
      absentToday: Math.max(0, totalMembers - presentToday - lateToday - onLeaveToday),
      pendingLeaveApprovals: leaveRes.rows[0]?.pendingLeaves || 0,
      pendingAppraisals: perfRes.rows[0]?.pendingAppraisals || 0,
      departmentBreakdown: deptRes.rows.map((r) => ({
        departmentId: r.departmentId,
        departmentName: r.departmentName || 'Unassigned',
        count: r.count,
      })),
    };
  },

  // =========================================================================
  // 4. Team Attendance Summary & Detail
  // =========================================================================

  async getTeamAttendance(currentUser, { date = null, managerId = null, status = '' } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    if (!targetManagerId || !isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) return [];
      targetManagerId = emp.id;
    }

    const queryDate = date || new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        e.id AS "employeeId",
        e.employee_code AS "employeeCode",
        e.first_name AS "firstName",
        e.last_name AS "lastName",
        e.email,
        e.shift_timing AS "shiftTiming",
        d.name AS "department",
        ds.title AS "designation",
        a.id AS "attendanceId",
        a.status AS "attendanceStatus",
        a.check_in AS "punchIn",
        a.check_out AS "punchOut",
        a.total_hours AS "totalHours",
        a.overtime_hours AS "overtimeHours",
        (CASE WHEN a.status = 'LATE' THEN true ELSE false END) AS "isLate"
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.attendance_date = $2
      WHERE e.manager_id = $1 AND e.org_id = $3
      ${status ? 'AND a.status = $4' : ''}
      ORDER BY e.first_name ASC, e.last_name ASC;
    `;
    const params = status
      ? [targetManagerId, queryDate, currentUser.orgId, status.toUpperCase()]
      : [targetManagerId, queryDate, currentUser.orgId];

    const { rows } = await pool.query(query, params);
    return rows.map((r) => ({
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      fullName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      email: r.email,
      department: r.department || '',
      designation: r.designation || '',
      shiftTiming: r.shiftTiming || '11:00 AM - 07:00 PM',
      attendance: r.attendanceId
        ? {
            id: r.attendanceId,
            status: r.attendanceStatus,
            punchIn: r.punchIn,
            punchOut: r.punchOut,
            totalHours: parseFloat(r.totalHours) || 0,
            overtimeHours: parseFloat(r.overtimeHours) || 0,
            isLate: !!r.isLate,
          }
        : {
            status: 'ABSENT',
            punchIn: null,
            punchOut: null,
            totalHours: 0,
            overtimeHours: 0,
            isLate: false,
          },
    }));
  },

  async getTeamAttendanceSummary(currentUser, { startDate = null, endDate = null, managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    if (!targetManagerId || !isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) {
        return {
          totalScheduledDays: 0,
          presentCount: 0,
          lateCount: 0,
          halfDayCount: 0,
          onLeaveCount: 0,
          absentCount: 0,
          totalHoursWorked: 0,
          overallAttendanceRate: 0,
        };
      }
      targetManagerId = emp.id;
    }

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const query = `
      SELECT 
        COUNT(a.id)::int AS "totalRecords",
        COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS "presentCount",
        COUNT(a.id) FILTER (WHERE a.status = 'LATE')::int AS "lateCount",
        COUNT(a.id) FILTER (WHERE a.status = 'HALF_DAY')::int AS "halfDayCount",
        COUNT(a.id) FILTER (WHERE a.status = 'ON_LEAVE')::int AS "onLeaveCount",
        COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')::int AS "absentCount",
        COALESCE(SUM(a.total_hours), 0)::numeric AS "totalHours"
      FROM attendance_records a
      JOIN employees e ON a.employee_id = e.id
      WHERE e.manager_id = $1 AND e.org_id = $2
        AND a.attendance_date >= $3::date AND a.attendance_date <= $4::date;
    `;
    const res = await pool.query(query, [targetManagerId, currentUser.orgId, start, end]);
    const row = res.rows[0] || {};
    const totalRecords = row.totalRecords || 0;
    const presentCount = row.presentCount || 0;
    const lateCount = row.lateCount || 0;
    const halfDayCount = row.halfDayCount || 0;

    return {
      dateRange: { startDate: start, endDate: end },
      totalRecords,
      presentCount,
      lateCount,
      halfDayCount,
      onLeaveCount: row.onLeaveCount || 0,
      absentCount: row.absentCount || 0,
      totalHoursWorked: parseFloat(row.totalHours) || 0,
      attendanceRate:
        totalRecords > 0
          ? parseFloat((((presentCount + lateCount + halfDayCount) / totalRecords) * 100).toFixed(1))
          : 0.0,
    };
  },

  async getTeamMemberAttendance(currentUser, employeeId, { startDate = null, endDate = null, limit = 50, page = 1 } = {}) {
    const targetEmp = await this.assertTeamScope(currentUser, employeeId);

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];
    const limitNum = Math.min(Math.max(1, parseInt(limit, 10) || 50), 100);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const offset = (pageNum - 1) * limitNum;

    const query = `
      SELECT 
        a.id, a.attendance_date AS "attendanceDate",
        a.check_in AS "checkIn", a.check_out AS "checkOut",
        a.total_hours AS "totalHours", a.status,
        a.is_regularized AS "isRegularized", a.regularization_reason AS "regularizationReason",
        a.notes, a.created_at AS "createdAt"
      FROM attendance_records a
      WHERE a.employee_id = $1
        AND a.attendance_date >= $2::date AND a.attendance_date <= $3::date
      ORDER BY a.attendance_date DESC
      LIMIT $4 OFFSET $5;
    `;
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM attendance_records
      WHERE employee_id = $1
        AND attendance_date >= $2::date AND attendance_date <= $3::date;
    `;

    const [recordsRes, countRes] = await Promise.all([
      pool.query(query, [targetEmp.id, start, end, limitNum, offset]),
      pool.query(countQuery, [targetEmp.id, start, end]),
    ]);

    const total = countRes.rows[0]?.total || 0;

    return {
      employee: {
        id: targetEmp.id,
        employeeCode: targetEmp.employeeCode,
        fullName: `${targetEmp.firstName || ''} ${targetEmp.lastName || ''}`.trim(),
        email: targetEmp.email,
      },
      records: recordsRes.rows.map((r) => ({
        id: r.id,
        attendanceDate: r.attendanceDate,
        checkIn: r.checkIn,
        checkOut: r.checkOut,
        totalHours: parseFloat(r.totalHours) || 0,
        status: r.status,
        isRegularized: Boolean(r.isRegularized),
        regularizationReason: r.regularizationReason,
        notes: r.notes,
      })),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  // =========================================================================
  // 5. Team Leave Information & Approvals
  // =========================================================================

  async getTeamLeaves(currentUser, { status = '', managerId = null, startDate = null, endDate = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    const conditions = ['e.org_id = $1'];
    const params = [currentUser.orgId];
    let pIndex = 2;

    if (targetManagerId) {
      conditions.push(`e.manager_id = $${pIndex++}`);
      params.push(targetManagerId);
    } else if (!isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) return [];
      conditions.push(`e.manager_id = $${pIndex++}`);
      params.push(emp.id);
    }

    if (status && status.trim()) {
      conditions.push(`lr.status = $${pIndex++}`);
      params.push(status.trim().toUpperCase());
    }

    if (startDate) {
      conditions.push(`lr.start_date >= $${pIndex++}::date`);
      params.push(startDate);
    }

    if (endDate) {
      conditions.push(`lr.end_date <= $${pIndex++}::date`);
      params.push(endDate);
    }

    const query = `
      SELECT 
        lr.*,
        lt.name AS "leaveTypeName",
        lt.code AS "leaveTypeCode",
        e.employee_code, e.first_name, e.last_name, e.email,
        d.name AS "departmentName"
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY lr.created_at DESC;
    `;
    const { rows } = await pool.query(query, params);
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      employeeCode: r.employee_code,
      department: r.departmentName || '',
      leaveTypeName: r.leaveTypeName,
      leaveTypeCode: r.leaveTypeCode,
      startDate: r.start_date,
      endDate: r.end_date,
      daysCount: parseFloat(r.total_days) || 0,
      reason: r.reason,
      status: r.status,
      appliedAt: r.created_at,
    }));
  },

  async getTeamMemberLeaves(currentUser, employeeId) {
    const targetEmp = await this.assertTeamScope(currentUser, employeeId);

    const [leavesRes, balancesRes] = await Promise.all([
      pool.query(
        `SELECT 
          lr.*,
          lt.name AS "leaveTypeName",
          lt.code AS "leaveTypeCode"
         FROM leave_requests lr
         JOIN leave_types lt ON lr.leave_type_id = lt.id
         WHERE lr.employee_id = $1
         ORDER BY lr.created_at DESC;`,
        [targetEmp.id]
      ),
      leaveRepository.getLeaveBalances(targetEmp.id, new Date().getFullYear()),
    ]);

    return {
      employee: {
        id: targetEmp.id,
        employeeCode: targetEmp.employeeCode,
        fullName: `${targetEmp.firstName || ''} ${targetEmp.lastName || ''}`.trim(),
        email: targetEmp.email,
      },
      balances: balancesRes,
      leaves: leavesRes.rows.map((r) => ({
        id: r.id,
        leaveTypeName: r.leaveTypeName,
        leaveTypeCode: r.leaveTypeCode,
        startDate: r.start_date,
        endDate: r.end_date,
        daysCount: parseFloat(r.total_days) || 0,
        reason: r.reason,
        status: r.status,
        appliedAt: r.created_at,
      })),
    };
  },

  async approveTeamLeave(currentUser, leaveId, { comments = '' } = {}) {
    if (!leaveId || typeof leaveId !== 'string' || !leaveId.trim()) {
      const err = new Error('Leave request ID is required.');
      err.statusCode = 400;
      throw err;
    }

    const leave = await leaveRepository.findById(leaveId.trim());
    if (!leave) {
      const err = new Error('Leave request not found.');
      err.statusCode = 404;
      throw err;
    }

    // Verify employee belongs to manager's team
    await this.assertTeamScope(currentUser, leave.employeeId);

    if (leave.status !== 'PENDING') {
      const err = new Error(`Cannot approve leave request: Current status is "${leave.status}". Only PENDING requests can be approved.`);
      err.statusCode = 400;
      throw err;
    }

    const managerEmp = await this.resolveManagerEmployee(currentUser);

    // Update leave status to APPROVED
    const updated = await leaveRepository.updateStatus(leave.id, {
      status: 'APPROVED',
      approverId: managerEmp?.id || null,
      approverUserId: currentUser.id,
    });

    // Adjust leave balance
    const year = new Date(leave.startDate).getFullYear();
    await leaveRepository.adjustBalance(leave.employeeId, leave.leaveTypeId, year, {
      pendingDelta: -leave.totalDays,
      usedDelta: leave.totalDays,
    });

    // Notify employee of approval
    const emp = await employeeRepository.findById(leave.employeeId);
    if (emp && emp.userId) {
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: emp.userId,
        eventType: 'LEAVE_APPROVED',
        title: 'Leave Request Approved',
        message: `Your leave request from ${leave.startDate} to ${leave.endDate} has been approved by your manager.${comments ? ` Note: ${comments}` : ''}`,
        entityType: 'LEAVE',
        entityId: leave.id,
        actionUrl: '/leaves',
      });
    }

    logger.info('ManagerService', `Manager ${currentUser.id} approved leave ${leaveId} for employee ${leave.employeeId}`);
    return updated;
  },

  async rejectTeamLeave(currentUser, leaveId, { rejectionReason = '' } = {}) {
    if (!leaveId || typeof leaveId !== 'string' || !leaveId.trim()) {
      const err = new Error('Leave request ID is required.');
      err.statusCode = 400;
      throw err;
    }

    if (!rejectionReason || !rejectionReason.trim()) {
      const err = new Error('Rejection reason is required.');
      err.statusCode = 400;
      throw err;
    }

    const leave = await leaveRepository.findById(leaveId.trim());
    if (!leave) {
      const err = new Error('Leave request not found.');
      err.statusCode = 404;
      throw err;
    }

    // Verify employee belongs to manager's team
    await this.assertTeamScope(currentUser, leave.employeeId);

    if (leave.status !== 'PENDING') {
      const err = new Error(`Cannot reject leave request: Current status is "${leave.status}". Only PENDING requests can be rejected.`);
      err.statusCode = 400;
      throw err;
    }

    const managerEmp = await this.resolveManagerEmployee(currentUser);

    // Update leave status to REJECTED
    const updated = await leaveRepository.updateStatus(leave.id, {
      status: 'REJECTED',
      approverId: managerEmp?.id || null,
      approverUserId: currentUser.id,
      rejectionReason: rejectionReason.trim(),
    });

    // Return pending days to remaining balance
    const year = new Date(leave.startDate).getFullYear();
    await leaveRepository.adjustBalance(leave.employeeId, leave.leaveTypeId, year, {
      pendingDelta: -leave.totalDays,
    });

    // Notify employee of rejection
    const emp = await employeeRepository.findById(leave.employeeId);
    if (emp && emp.userId) {
      await notificationService.createSystemNotification({
        orgId: currentUser.orgId,
        userId: emp.userId,
        eventType: 'LEAVE_REJECTED',
        title: 'Leave Request Rejected',
        message: `Your leave request from ${leave.startDate} to ${leave.endDate} was rejected by your manager: "${rejectionReason.trim()}"`,
        entityType: 'LEAVE',
        entityId: leave.id,
        actionUrl: '/leaves',
      });
    }

    logger.info('ManagerService', `Manager ${currentUser.id} rejected leave ${leaveId} for employee ${leave.employeeId}`);
    return updated;
  },

  // =========================================================================
  // 6. Team Performance Information
  // =========================================================================

  async getTeamPerformance(currentUser, { status = '', periodId = '', managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    if (!targetManagerId || !isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) return [];
      targetManagerId = emp.id;
    }

    const conditions = ['(e.manager_id = $1 OR pr.reviewer_id = $1)', 'pr.org_id = $2'];
    const params = [targetManagerId, currentUser.orgId];
    let pIndex = 3;

    if (status && status.trim()) {
      conditions.push(`pr.status = $${pIndex++}`);
      params.push(status.trim().toUpperCase());
    }

    if (periodId && periodId.trim()) {
      conditions.push(`pr.period_id = $${pIndex++}`);
      params.push(periodId.trim());
    }

    const query = `
      SELECT 
        pr.*,
        e.employee_code AS "employeeCode",
        e.first_name AS "firstName",
        e.last_name AS "lastName",
        e.email,
        d.name AS "departmentName",
        ds.title AS "designationTitle",
        pp.name AS "periodName",
        pp.period_type AS "periodType"
      FROM performance_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN performance_periods pp ON pr.period_id = pp.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY pr.created_at DESC;
    `;
    const { rows } = await pool.query(query, params);
    return rows.map((r) => ({
      id: r.id,
      recordNumber: r.record_number,
      employeeId: r.employee_id,
      employeeCode: r.employeeCode,
      fullName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      email: r.email,
      department: r.departmentName || '',
      designation: r.designationTitle || '',
      reviewPeriod: r.review_period,
      periodName: r.periodName,
      status: r.status,
      approvalState: r.approval_state,
      rating: parseFloat(r.rating) || null,
      score: parseFloat(r.score) || null,
      selfComments: r.self_comments,
      reviewerComments: r.reviewer_comments,
      reviewDate: r.review_date,
      createdAt: r.created_at,
    }));
  },

  async getTeamMemberPerformance(currentUser, employeeId) {
    const targetEmp = await this.assertTeamScope(currentUser, employeeId);

    const records = await performanceRepository.findRecords(currentUser.orgId, {
      employeeId: targetEmp.id,
    });

    return {
      employee: {
        id: targetEmp.id,
        employeeCode: targetEmp.employeeCode,
        fullName: `${targetEmp.firstName || ''} ${targetEmp.lastName || ''}`.trim(),
        email: targetEmp.email,
      },
      records,
    };
  },

  // =========================================================================
  // 7. Pending Manager Approvals (Consolidated Action Queue)
  // =========================================================================

  async getPendingApprovals(currentUser, { managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    let targetManagerId = managerId;

    if (!targetManagerId || !isHrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) {
        return {
          leaves: [],
          appraisals: [],
          totalPending: 0,
        };
      }
      targetManagerId = emp.id;
    }

    const [leavesRes, perfRes] = await Promise.all([
      // Pending Leaves for direct reports
      pool.query(
        `SELECT 
          lr.id,
          lr.employee_id AS "employeeId",
          e.employee_code AS "employeeCode",
          e.first_name AS "firstName",
          e.last_name AS "lastName",
          lt.name AS "leaveTypeName",
          lt.code AS "leaveTypeCode",
          lr.start_date AS "startDate",
          lr.end_date AS "endDate",
          lr.total_days AS "daysCount",
          lr.reason,
          lr.status,
          lr.created_at AS "appliedAt"
        FROM leave_requests lr
        JOIN employees e ON lr.employee_id = e.id
        JOIN leave_types lt ON lr.leave_type_id = lt.id
        WHERE e.manager_id = $1 AND lr.status = 'PENDING'
        ORDER BY lr.created_at DESC;`,
        [targetManagerId]
      ),

      // Pending Performance Appraisals for direct reports awaiting manager rating
      pool.query(
        `SELECT 
          pr.id,
          pr.record_number AS "recordNumber",
          pr.employee_id AS "employeeId",
          e.employee_code AS "employeeCode",
          e.first_name AS "firstName",
          e.last_name AS "lastName",
          d.name AS "departmentName",
          pr.review_period AS "reviewPeriod",
          pr.self_comments AS "selfComments",
          pr.status,
          pr.approval_state AS "approvalState",
          pr.created_at AS "submittedAt"
        FROM performance_records pr
        JOIN employees e ON pr.employee_id = e.id
        LEFT JOIN departments d ON e.dept_id = d.id
        WHERE (e.manager_id = $1 OR pr.reviewer_id = $1)
          AND pr.status IN ('SUBMITTED', 'PENDING')
        ORDER BY pr.created_at DESC;`,
        [targetManagerId]
      ),
    ]);

    const leaves = leavesRes.rows.map((r) => ({
      id: r.id,
      module: 'LEAVE',
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      employeeName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      leaveTypeName: r.leaveTypeName,
      leaveTypeCode: r.leaveTypeCode,
      startDate: r.startDate,
      endDate: r.endDate,
      daysCount: parseFloat(r.daysCount) || 0,
      reason: r.reason,
      status: r.status,
      appliedAt: r.appliedAt,
    }));

    const appraisals = perfRes.rows.map((r) => ({
      id: r.id,
      module: 'PERFORMANCE',
      recordNumber: r.recordNumber,
      employeeId: r.employeeId,
      employeeCode: r.employeeCode,
      employeeName: `${r.firstName || ''} ${r.lastName || ''}`.trim(),
      department: r.departmentName || '',
      reviewPeriod: r.reviewPeriod,
      selfComments: r.selfComments,
      status: r.status,
      approvalState: r.approvalState,
      submittedAt: r.submittedAt,
    }));

    return {
      leaves,
      appraisals,
      totalPending: leaves.length + appraisals.length,
    };
  },

  // =========================================================================
  // 8. Manager Assignment Engine
  // =========================================================================

  async assignManager(currentUser, { employeeId, managerId }) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);

    if (!isHrAdmin) {
      const err = new Error('Forbidden: Only HR or Administrators can assign employee managers.');
      err.statusCode = 403;
      throw err;
    }

    const employee = await employeeRepository.findById(employeeId);
    if (!employee || employee.orgId !== currentUser.orgId) {
      const err = new Error('Employee not found in your organization.');
      err.statusCode = 404;
      throw err;
    }

    if (managerId) {
      const manager = await employeeRepository.findById(managerId);
      if (!manager || manager.orgId !== currentUser.orgId) {
        const err = new Error('Target manager employee not found in your organization.');
        err.statusCode = 404;
        throw err;
      }
    }

    const updated = await employeeRepository.assignManager(employeeId, managerId);
    logger.info('ManagerService', `Assigned manager ${managerId || 'None'} to employee ${employeeId}`);
    return updated;
  },
};

export default managerService;
