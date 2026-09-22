import { employeeRepository } from '../repositories/employeeRepository.js';
import { leaveRepository } from '../repositories/leaveRepository.js';
import { attendanceRepository } from '../repositories/attendanceRepository.js';
import { performanceRepository } from '../repositories/performanceRepository.js';
import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';
import { notificationService } from './notificationService.js';
import { validateEmployeeId } from '../validators/managerValidator.js';

const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const teamService = {
  /**
   * Helper: Check if user has HR or Admin privileges
   */
  isHrOrAdmin(currentUser) {
    const role = normalizeRole(currentUser.roleName);
    return ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(role);
  },

  /**
   * Helper: Check if user has Manager role
   */
  isManager(currentUser) {
    const role = normalizeRole(currentUser.roleName);
    return ['manager'].includes(role);
  },

  /**
   * Helper: Check if user has Employee role
   */
  isEmployee(currentUser) {
    const role = normalizeRole(currentUser.roleName);
    return ['employee'].includes(role);
  },

  /**
   * Helper: Resolve current user's employee record
   */
  async resolveEmployee(currentUser) {
    if (!currentUser || !currentUser.id) return null;

    let emp = await employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
    if (emp) return emp;

    if (currentUser.email) {
      emp = await employeeRepository.findByEmail(currentUser.email, currentUser.orgId);
      if (emp) return emp;
    }

    if (currentUser.email && this.isHrOrAdmin(currentUser)) {
      emp = await employeeRepository.findByEmail(currentUser.email);
      if (emp) return emp;
    }

    return null;
  },

  /**
   * SECURITY ENFORCEMENT: Validate team access scope
   * - Employees: Own data only (or peer view where specifically permitted)
   * - Managers: Assigned direct reports only
   * - HR: Organization scope
   * - Admin: Administrative scope
   */
  async assertTeamAccess(currentUser, targetEmployeeId, { allowPeers = false } = {}) {
    const idError = validateEmployeeId(targetEmployeeId);
    if (idError) {
      const err = new Error(idError);
      err.statusCode = 400;
      throw err;
    }

    const cleanId = targetEmployeeId.trim();
    const isHrAdmin = this.isHrOrAdmin(currentUser);

    const targetEmp = await employeeRepository.findById(cleanId);
    if (!targetEmp) {
      const err = new Error(`Employee with ID '${cleanId}' not found.`);
      err.statusCode = 404;
      throw err;
    }

    // Cross-organization prevention
    if (targetEmp.orgId !== currentUser.orgId && !isHrAdmin) {
      const err = new Error('Access denied: Employee not found in your organization.');
      err.statusCode = 404;
      throw err;
    }

    // Administrative scope: HR and Admin have full organization access
    if (isHrAdmin) {
      return targetEmp;
    }

    const requesterEmp = await this.resolveEmployee(currentUser);
    if (!requesterEmp) {
      const err = new Error('Access denied: No employee profile found for your account.');
      err.statusCode = 403;
      throw err;
    }

    // Security invariant: Exited or deprovisioned employee cannot access team data
    if (requesterEmp.status === 'Exited' || requesterEmp.status === 'Terminated' || requesterEmp.status === 'Inactive') {
      const err = new Error('Access denied: Your employee profile has been deprovisioned.');
      err.statusCode = 403;
      throw err;
    }

    // Self-access is always authorized
    if (targetEmp.id === requesterEmp.id) {
      return targetEmp;
    }

    // Manager scope: MUST be direct report
    if (this.isManager(currentUser)) {
      if (targetEmp.managerId !== requesterEmp.id) {
        const err = new Error('Access denied: This employee is not assigned to your authorized team.');
        err.statusCode = 403;
        throw err;
      }
      return targetEmp;
    }

    // Employee scope
    if (allowPeers) {
      // Peer check: Must share the same non-null manager
      if (
        requesterEmp.managerId &&
        targetEmp.managerId &&
        requesterEmp.managerId === targetEmp.managerId
      ) {
        return targetEmp;
      }
    }

    const err = new Error('Access denied: You are only authorized to access your own team data.');
    err.statusCode = 403;
    throw err;
  },

  /**
   * Circular hierarchy detection
   */
  async detectManagerCycle(employeeId, newManagerId) {
    if (!newManagerId) return false;
    let currentId = newManagerId;
    const visited = new Set([employeeId]);

    while (currentId) {
      if (visited.has(currentId)) {
        return true;
      }
      visited.add(currentId);
      const mgr = await employeeRepository.findById(currentId);
      currentId = mgr?.managerId || null;
    }
    return false;
  },

  // =========================================================================
  // 1. View Team Members
  // =========================================================================

  async getTeamMembers(currentUser, { managerId = null, search = '', departmentId = '', status = '' } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    // Security invariant: Exited or deprovisioned employee/manager cannot access team members
    if (requesterEmp && (requesterEmp.status === 'Exited' || requesterEmp.status === 'Terminated' || requesterEmp.status === 'Inactive') && !isHrAdmin) {
      const err = new Error('Access denied: Your employee profile has been deprovisioned.');
      err.statusCode = 403;
      throw err;
    }

    let targetManagerId = null;

    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) {
        const err = new Error('No employee profile found for your manager account.');
        err.statusCode = 403;
        throw err;
      }
      // Manager ID manipulation prevention
      if (managerId && managerId !== requesterEmp.id) {
        const err = new Error('Access denied: Managers can only view their own assigned team.');
        err.statusCode = 403;
        throw err;
      }
      targetManagerId = requesterEmp.id;
    } else {
      // Standard employee
      if (!requesterEmp) {
        return [];
      }
      // If employee has a manager, view peers in the same team
      if (requesterEmp.managerId) {
        targetManagerId = requesterEmp.managerId;
      } else {
        // Return only own record
        return [requesterEmp];
      }
    }

    let members = [];
    if (targetManagerId) {
      members = await employeeRepository.findDirectReports(targetManagerId, currentUser.orgId);
      // Filter out deprovisioned/exited team members from active manager roster unless explicitly requested
      if (!status) {
        members = members.filter((m) => !['exited', 'terminated'].includes((m.status || '').toLowerCase()));
      }
    } else if (isHrAdmin) {
      // Organization-wide team roster
      const result = await employeeRepository.findAll({
        orgId: currentUser.orgId,
        deptId: departmentId || undefined,
        status: status || undefined,
        limit: 100,
        page: 1,
      });
      members = result.employees || [];
    }

    // Filter search
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      members = members.filter(
        (m) =>
          (m.firstName || '').toLowerCase().includes(q) ||
          (m.lastName || '').toLowerCase().includes(q) ||
          (m.email || '').toLowerCase().includes(q) ||
          (m.employeeCode || '').toLowerCase().includes(q)
      );
    }

    if (departmentId && departmentId.trim()) {
      members = members.filter((m) => m.deptId === departmentId.trim());
    }

    if (status && status.trim()) {
      members = members.filter((m) => (m.status || '').toLowerCase() === status.trim().toLowerCase());
    }

    // Sanitize sensitive fields if viewed by regular employee peer
    if (this.isEmployee(currentUser)) {
      return members.map((m) => ({
        id: m.id,
        employeeCode: m.employeeCode,
        firstName: m.firstName,
        lastName: m.lastName,
        fullName: `${m.firstName || ''} ${m.lastName || ''}`.trim(),
        email: m.email,
        department: m.department?.name || m.departmentName || '',
        designation: m.designation?.title || m.designationTitle || '',
        shiftTiming: m.shiftTiming || '11:00 AM - 07:00 PM',
        status: m.status,
      }));
    }

    return members;
  },

  // =========================================================================
  // 2. Team Summary
  // =========================================================================

  async getTeamSummary(currentUser, { managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    // Security invariant: Exited or deprovisioned employee/manager cannot access team summary
    if (requesterEmp && (requesterEmp.status === 'Exited' || requesterEmp.status === 'Terminated' || requesterEmp.status === 'Inactive') && !isHrAdmin) {
      const err = new Error('Access denied: Your employee profile has been deprovisioned.');
      err.statusCode = 403;
      throw err;
    }

    let targetManagerId = null;

    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) {
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
      if (managerId && managerId !== requesterEmp.id) {
        const err = new Error('Access denied: Managers can only view summary for their own team.');
        err.statusCode = 403;
        throw err;
      }
      targetManagerId = requesterEmp.id;
    } else {
      // Employee view of their assigned team
      targetManagerId = requesterEmp?.managerId || null;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    if (targetManagerId) {
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
        pendingLeaveApprovals: isHrAdmin || this.isManager(currentUser) ? leaveRes.rows[0]?.pendingLeaves || 0 : undefined,
        pendingAppraisals: isHrAdmin || this.isManager(currentUser) ? perfRes.rows[0]?.pendingAppraisals || 0 : undefined,
        departmentBreakdown: deptRes.rows.map((r) => ({
          departmentId: r.departmentId,
          departmentName: r.departmentName || 'General',
          count: r.count,
        })),
      };
    } else {
      // Org-wide summary (HR/Admin)
      const orgRes = await pool.query(
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
        WHERE e.org_id = $1;`,
        [currentUser.orgId, todayStr]
      );
      const row = orgRes.rows[0] || {};
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
        departmentBreakdown: [],
      };
    }
  },

  // =========================================================================
  // 3. Team Employee Details Where Authorized
  // =========================================================================

  async getTeamEmployeeDetails(currentUser, employeeId) {
    const targetEmp = await this.assertTeamAccess(currentUser, employeeId, { allowPeers: true });

    // Fetch manager details
    let manager = null;
    if (targetEmp.managerId) {
      const mgr = await employeeRepository.findById(targetEmp.managerId);
      if (mgr) {
        manager = {
          id: mgr.id,
          employeeCode: mgr.employeeCode,
          fullName: `${mgr.firstName || ''} ${mgr.lastName || ''}`.trim(),
          email: mgr.email,
        };
      }
    }

    const isSelfOrPrivileged = this.isHrOrAdmin(currentUser) || 
      (await this.resolveEmployee(currentUser))?.id === targetEmp.id;

    return {
      id: targetEmp.id,
      employeeCode: targetEmp.employeeCode,
      firstName: targetEmp.firstName,
      lastName: targetEmp.lastName,
      fullName: `${targetEmp.firstName || ''} ${targetEmp.lastName || ''}`.trim(),
      email: targetEmp.email,
      phone: targetEmp.phone,
      department: targetEmp.department?.name || '',
      designation: targetEmp.designation?.title || '',
      shiftTiming: targetEmp.shiftTiming || '11:00 AM - 07:00 PM',
      employmentType: targetEmp.employmentType || 'Full-Time',
      status: targetEmp.status,
      dateOfJoining: targetEmp.dateOfJoining,
      salary: isSelfOrPrivileged ? targetEmp.salary : undefined,
      manager,
    };
  },

  // =========================================================================
  // 4. Team Attendance Summary
  // =========================================================================

  async getTeamAttendance(currentUser, { date = null, managerId = null, status = '' } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    let targetManagerId = null;

    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) return [];
      if (managerId && managerId !== requesterEmp.id) {
        const err = new Error('Access denied: Managers can only access their own team attendance.');
        err.statusCode = 403;
        throw err;
      }
      targetManagerId = requesterEmp.id;
    } else {
      // Employee: can only view own attendance
      if (!requesterEmp) return [];
      const queryDate = date || new Date().toISOString().split('T')[0];
      const records = await attendanceRepository.findAll(currentUser.orgId, {
        employeeId: requesterEmp.id,
        startDate: queryDate,
        endDate: queryDate,
      });
      return records.records || [];
    }

    const queryDate = date || new Date().toISOString().split('T')[0];
    const whereConditions = ['e.org_id = $1'];
    const params = [currentUser.orgId, queryDate];
    let pIdx = 3;

    if (targetManagerId) {
      whereConditions.push(`e.manager_id = $${pIdx++}`);
      params.push(targetManagerId);
    }

    if (status && status.trim()) {
      whereConditions.push(`a.status = $${pIdx++}`);
      params.push(status.trim().toUpperCase());
    }

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
        (CASE WHEN a.status = 'LATE' THEN true ELSE false END) AS "isLate"
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.attendance_date = $2
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY e.first_name ASC, e.last_name ASC;
    `;
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
            isLate: !!r.isLate,
          }
        : {
            status: 'ABSENT',
            punchIn: null,
            punchOut: null,
            totalHours: 0,
            isLate: false,
          },
    }));
  },

  async getTeamAttendanceSummary(currentUser, { startDate = null, endDate = null, managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    let targetManagerId = null;
    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) {
        return {
          totalRecords: 0,
          presentCount: 0,
          lateCount: 0,
          halfDayCount: 0,
          onLeaveCount: 0,
          absentCount: 0,
          totalHoursWorked: 0,
          attendanceRate: 0,
        };
      }
      targetManagerId = requesterEmp.id;
    } else {
      targetManagerId = requesterEmp?.managerId || null;
    }

    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const whereConditions = [
      'e.org_id = $1',
      'a.attendance_date >= $2::date',
      'a.attendance_date <= $3::date',
    ];
    const params = [currentUser.orgId, start, end];

    if (targetManagerId) {
      whereConditions.push('e.manager_id = $4');
      params.push(targetManagerId);
    }

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
      WHERE ${whereConditions.join(' AND ')};
    `;
    const res = await pool.query(query, params);
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
    const targetEmp = await this.assertTeamAccess(currentUser, employeeId, { allowPeers: false });

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
        total: countRes.rows[0]?.total || 0,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil((countRes.rows[0]?.total || 0) / limitNum) || 1,
      },
    };
  },

  // =========================================================================
  // 5. Team Leave Summary
  // =========================================================================

  async getTeamLeaves(currentUser, { status = '', managerId = null, startDate = null, endDate = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    let targetManagerId = null;

    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) return [];
      if (managerId && managerId !== requesterEmp.id) {
        const err = new Error('Access denied: Managers can only view leaves for their own team.');
        err.statusCode = 403;
        throw err;
      }
      targetManagerId = requesterEmp.id;
    } else {
      // Employee: Own leaves only
      if (!requesterEmp) return [];
      const res = await leaveRepository.findByEmployee(requesterEmp.id, currentUser.orgId);
      return res || [];
    }

    const conditions = ['e.org_id = $1'];
    const params = [currentUser.orgId];
    let pIndex = 2;

    if (targetManagerId) {
      conditions.push(`e.manager_id = $${pIndex++}`);
      params.push(targetManagerId);
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

  async getTeamLeaveSummary(currentUser, { managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    let targetManagerId = null;
    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) return { pendingLeaves: 0, approvedThisMonth: 0, onLeaveToday: 0 };
      targetManagerId = requesterEmp.id;
    } else {
      targetManagerId = requesterEmp?.managerId || null;
    }

    const conditions = ['e.org_id = $1'];
    const params = [currentUser.orgId];
    if (targetManagerId) {
      conditions.push('e.manager_id = $2');
      params.push(targetManagerId);
    }

    const query = `
      SELECT 
        COUNT(lr.id) FILTER (WHERE lr.status = 'PENDING')::int AS "pendingLeaves",
        COUNT(lr.id) FILTER (WHERE lr.status = 'APPROVED' AND lr.created_at >= DATE_TRUNC('month', CURRENT_DATE))::int AS "approvedThisMonth",
        COUNT(lr.id) FILTER (WHERE lr.status = 'APPROVED' AND CURRENT_DATE >= lr.start_date AND CURRENT_DATE <= lr.end_date)::int AS "onLeaveToday"
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE ${conditions.join(' AND ')};
    `;
    const res = await pool.query(query, params);
    const row = res.rows[0] || {};
    return {
      pendingLeaves: row.pendingLeaves || 0,
      approvedThisMonth: row.approvedThisMonth || 0,
      onLeaveToday: row.onLeaveToday || 0,
    };
  },

  async getTeamMemberLeaves(currentUser, employeeId) {
    const targetEmp = await this.assertTeamAccess(currentUser, employeeId, { allowPeers: false });

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

  // =========================================================================
  // 6. Team Performance Summary
  // =========================================================================

  async getTeamPerformance(currentUser, { status = '', periodId = '', managerId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    let targetManagerId = null;

    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) return [];
      if (managerId && managerId !== requesterEmp.id) {
        const err = new Error('Access denied: Managers can only view performance for their own team.');
        err.statusCode = 403;
        throw err;
      }
      targetManagerId = requesterEmp.id;
    } else {
      // Employee: own records only
      if (!requesterEmp) return [];
      return performanceRepository.findRecords(currentUser.orgId, { employeeId: requesterEmp.id });
    }

    const conditions = ['pr.org_id = $1'];
    const params = [currentUser.orgId];
    let pIdx = 2;

    if (targetManagerId) {
      conditions.push(`(e.manager_id = $${pIdx} OR pr.reviewer_id = $${pIdx})`);
      params.push(targetManagerId);
      pIdx++;
    }

    if (status && status.trim()) {
      conditions.push(`pr.status = $${pIdx++}`);
      params.push(status.trim().toUpperCase());
    }

    if (periodId && periodId.trim()) {
      conditions.push(`pr.period_id = $${pIdx++}`);
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

  async getTeamPerformanceSummary(currentUser, { managerId = null, periodId = null } = {}) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    const requesterEmp = await this.resolveEmployee(currentUser);

    let targetManagerId = null;
    if (isHrAdmin) {
      targetManagerId = managerId || null;
    } else if (this.isManager(currentUser)) {
      if (!requesterEmp) {
        return {
          totalAppraisals: 0,
          pendingManagerReview: 0,
          pendingHrApproval: 0,
          completedCount: 0,
          averageRating: 0.0,
        };
      }
      targetManagerId = requesterEmp.id;
    } else {
      targetManagerId = requesterEmp?.managerId || null;
    }

    const conditions = ['pr.org_id = $1'];
    const params = [currentUser.orgId];
    let pIdx = 2;

    if (targetManagerId) {
      conditions.push(`(e.manager_id = $${pIdx} OR pr.reviewer_id = $${pIdx})`);
      params.push(targetManagerId);
      pIdx++;
    }

    if (periodId && periodId.trim()) {
      conditions.push(`pr.period_id = $${pIdx++}`);
      params.push(periodId.trim());
    }

    const query = `
      SELECT 
        COUNT(pr.id)::int AS "totalAppraisals",
        COUNT(pr.id) FILTER (WHERE pr.status IN ('SUBMITTED', 'PENDING'))::int AS "pendingManagerReview",
        COUNT(pr.id) FILTER (WHERE pr.status = 'UNDER_REVIEW')::int AS "pendingHrApproval",
        COUNT(pr.id) FILTER (WHERE pr.status = 'APPROVED')::int AS "completedCount",
        COALESCE(AVG(pr.rating) FILTER (WHERE pr.status = 'APPROVED' AND pr.rating IS NOT NULL), 0)::numeric AS "avgRating"
      FROM performance_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE ${conditions.join(' AND ')};
    `;
    const res = await pool.query(query, params);
    const row = res.rows[0] || {};
    return {
      totalAppraisals: row.totalAppraisals || 0,
      pendingManagerReview: row.pendingManagerReview || 0,
      pendingHrApproval: row.pendingHrApproval || 0,
      completedCount: row.completedCount || 0,
      averageRating: parseFloat(parseFloat(row.avgRating || 0).toFixed(2)),
    };
  },

  async getTeamMemberPerformance(currentUser, employeeId) {
    const targetEmp = await this.assertTeamAccess(currentUser, employeeId, { allowPeers: false });

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
  // 7. Team Assignment & Hierarchy Management (HR & Admin Scope)
  // =========================================================================

  async assignTeamManager(currentUser, { employeeId, managerId, hrId }) {
    const isHrAdmin = this.isHrOrAdmin(currentUser);
    if (!isHrAdmin) {
      const err = new Error('Forbidden: Only HR or Administrators can assign team managers or HR partners.');
      err.statusCode = 403;
      throw err;
    }

    const empIdErr = validateEmployeeId(employeeId);
    if (empIdErr) {
      const err = new Error(empIdErr);
      err.statusCode = 400;
      throw err;
    }

    const employee = await employeeRepository.findById(employeeId.trim());
    if (!employee || employee.orgId !== currentUser.orgId) {
      const err = new Error('Employee not found in your organization.');
      err.statusCode = 404;
      throw err;
    }

    if (managerId !== undefined && managerId !== null && managerId !== '') {
      const mgrIdErr = validateEmployeeId(managerId);
      if (mgrIdErr) {
        const err = new Error(`Manager ID error: ${mgrIdErr}`);
        err.statusCode = 400;
        throw err;
      }

      if (employee.id === managerId.trim()) {
        const err = new Error('An employee cannot be assigned as their own manager.');
        err.statusCode = 400;
        throw err;
      }

      const manager = await employeeRepository.findById(managerId.trim());
      if (!manager || manager.orgId !== currentUser.orgId) {
        const err = new Error('Target manager employee not found in your organization.');
        err.statusCode = 404;
        throw err;
      }

      // Hierarchy cycle detection
      const isCycle = await this.detectManagerCycle(employee.id, manager.id);
      if (isCycle) {
        const err = new Error('Circular hierarchy detected: Employee cannot report to someone who reports to them.');
        err.statusCode = 400;
        throw err;
      }
    }

    if (hrId !== undefined && hrId !== null && hrId !== '') {
      const hrIdErr = validateEmployeeId(hrId);
      if (hrIdErr) {
        const err = new Error(`HR ID error: ${hrIdErr}`);
        err.statusCode = 400;
        throw err;
      }

      if (employee.id === hrId.trim()) {
        const err = new Error('An employee cannot be assigned as their own HR partner.');
        err.statusCode = 400;
        throw err;
      }

      const hrEmp = await employeeRepository.findById(hrId.trim());
      if (!hrEmp || hrEmp.orgId !== currentUser.orgId) {
        const err = new Error('Target HR partner employee not found in your organization.');
        err.statusCode = 404;
        throw err;
      }
    }

    const updatePayload = {};
    if (managerId !== undefined) {
      updatePayload.managerId = managerId ? managerId.trim() : null;
    }
    if (hrId !== undefined) {
      updatePayload.hrId = hrId ? hrId.trim() : null;
    }

    const updated = await employeeRepository.assignHierarchy(employee.id, updatePayload);
    logger.info('TeamService', `Admin ${currentUser.id} assigned hierarchy manager:${updatePayload.managerId || 'Unchanged'} hr:${updatePayload.hrId || 'Unchanged'} to employee ${employeeId}`);

    // Notify employee and manager if manager changed
    if (managerId !== undefined) {
      try {
        const manager = updatePayload.managerId ? await employeeRepository.findById(updatePayload.managerId) : null;
        await notificationService.notifyManagerAssigned({
          orgId: currentUser.orgId,
          employeeName: `${employee.firstName || ''} ${employee.lastName || ''}`.trim(),
          managerName: manager ? `${manager.firstName || ''} ${manager.lastName || ''}`.trim() : 'None',
          employeeUserId: employee.userId,
          managerUserId: manager?.userId || null,
        });
      } catch (notifErr) {
        logger.warn('TeamService', `Failed to dispatch manager assignment notification: ${notifErr.message}`);
      }
    }

    return updated;
  },
};

export default teamService;
