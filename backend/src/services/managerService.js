import { employeeRepository } from '../repositories/employeeRepository.js';
import { pool } from '../config/db.js';
import { logger } from '../utils/logger.js';

export const managerService = {
  /**
   * Resolve current user's employee record as a manager
   */
  async resolveManagerEmployee(currentUser) {
    const emp = await employeeRepository.findByUserId(currentUser.id, currentUser.orgId);
    return emp;
  },

  /**
   * Get direct reports for manager
   */
  async getTeamMembers(currentUser, { managerId = null, search = '' } = {}) {
    const isHrOrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager'].includes(
      (currentUser.roleName || '').toLowerCase()
    );

    let targetManagerId = managerId;
    if (!targetManagerId || !isHrOrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) {
        // If Admin/HR with no linked employee record and no managerId query, return empty list
        if (isHrOrAdmin) return [];
        const err = new Error('No employee profile associated with your manager account.');
        err.statusCode = 404;
        throw err;
      }
      targetManagerId = emp.id;
    }

    const members = await employeeRepository.findDirectReports(targetManagerId, currentUser.orgId);

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      return members.filter(
        (m) =>
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q) ||
          m.employeeCode.toLowerCase().includes(q)
      );
    }

    return members;
  },

  /**
   * Get team overview metrics (headcount, present today, on leave today, pending reviews)
   */
  async getTeamSummary(currentUser, { managerId = null } = {}) {
    const isHrOrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager'].includes(
      (currentUser.roleName || '').toLowerCase()
    );

    let targetManagerId = managerId;
    if (!targetManagerId || !isHrOrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) {
        return {
          totalMembers: 0,
          activeMembers: 0,
          onLeaveToday: 0,
          presentToday: 0,
          pendingLeaveApprovals: 0,
          pendingAppraisals: 0,
        };
      }
      targetManagerId = emp.id;
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Query aggregated metrics for this manager's team
    const query = `
      SELECT 
        COUNT(e.id)::int AS "totalMembers",
        COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'active')::int AS "activeMembers",
        COUNT(e.id) FILTER (WHERE LOWER(e.status) = 'on leave')::int AS "onLeaveToday",
        COUNT(DISTINCT a.id)::int AS "presentToday"
      FROM employees e
      LEFT JOIN attendance_records a 
        ON a.employee_id = e.id 
        AND a.attendance_date = $2 
        AND a.status IN ('PRESENT', 'HALF_DAY')
      WHERE e.manager_id = $1 AND e.org_id = $3;
    `;
    const res = await pool.query(query, [targetManagerId, todayStr, currentUser.orgId]);
    const basicSummary = res.rows[0] || {
      totalMembers: 0,
      activeMembers: 0,
      onLeaveToday: 0,
      presentToday: 0,
    };

    // Pending leaves for this team
    const leaveQuery = `
      SELECT COUNT(lr.id)::int AS "pendingLeaves"
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      WHERE e.manager_id = $1 AND lr.status = 'PENDING';
    `;
    const leaveRes = await pool.query(leaveQuery, [targetManagerId]);
    const pendingLeaveApprovals = leaveRes.rows[0]?.pendingLeaves || 0;

    // Pending performance appraisals at manager stage
    const perfQuery = `
      SELECT COUNT(pr.id)::int AS "pendingAppraisals"
      FROM performance_records pr
      JOIN employees e ON pr.employee_id = e.id
      WHERE (e.manager_id = $1 OR pr.reviewer_id = $1)
        AND pr.status IN ('SUBMITTED', 'UNDER_REVIEW');
    `;
    const perfRes = await pool.query(perfQuery, [targetManagerId]);
    const pendingAppraisals = perfRes.rows[0]?.pendingAppraisals || 0;

    return {
      ...basicSummary,
      pendingLeaveApprovals,
      pendingAppraisals,
    };
  },

  /**
   * Get team daily attendance summary
   */
  async getTeamAttendance(currentUser, { date = null, managerId = null } = {}) {
    const isHrOrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager'].includes(
      (currentUser.roleName || '').toLowerCase()
    );

    let targetManagerId = managerId;
    if (!targetManagerId || !isHrOrAdmin) {
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
        (CASE WHEN a.status = 'LATE' THEN true ELSE false END) AS "isLate"
      FROM employees e
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN attendance_records a ON a.employee_id = e.id AND a.attendance_date = $2
      WHERE e.manager_id = $1 AND e.org_id = $3
      ORDER BY e.first_name ASC, e.last_name ASC;
    `;
    const { rows } = await pool.query(query, [targetManagerId, queryDate, currentUser.orgId]);
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

  /**
   * Get team pending leaves
   */
  async getTeamLeaves(currentUser, { status = 'PENDING', managerId = null } = {}) {
    const isHrOrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager'].includes(
      (currentUser.roleName || '').toLowerCase()
    );

    let targetManagerId = managerId;
    if (!targetManagerId || !isHrOrAdmin) {
      const emp = await this.resolveManagerEmployee(currentUser);
      if (!emp) return [];
      targetManagerId = emp.id;
    }

    const query = `
      SELECT 
        lr.*,
        lt.name AS "leaveTypeName",
        lt.code AS "leaveTypeCategory",
        e.employee_code, e.first_name, e.last_name, e.email,
        d.name AS "departmentName"
      FROM leave_requests lr
      JOIN employees e ON lr.employee_id = e.id
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      LEFT JOIN departments d ON e.dept_id = d.id
      WHERE e.manager_id = $1 
        ${status ? 'AND lr.status = $2' : ''}
      ORDER BY lr.created_at DESC;
    `;
    const params = status ? [targetManagerId, status] : [targetManagerId];
    const { rows } = await pool.query(query, params);
    return rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      employeeName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      employeeCode: r.employee_code,
      department: r.departmentName || '',
      leaveTypeName: r.leaveTypeName,
      leaveCategory: r.leaveTypeCategory,
      startDate: r.start_date,
      endDate: r.end_date,
      daysCount: parseFloat(r.total_days) || 0,
      reason: r.reason,
      status: r.status,
      appliedAt: r.created_at,
    }));
  },

  /**
   * Assign or reassign employee's reporting manager
   */
  async assignManager(currentUser, { employeeId, managerId }) {
    const isHrOrAdmin = ['admin', 'superadmin', 'hr', 'hrmanager'].includes(
      (currentUser.roleName || '').toLowerCase()
    );

    if (!isHrOrAdmin) {
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
