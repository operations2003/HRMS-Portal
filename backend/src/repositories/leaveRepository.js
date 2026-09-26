import { pool } from '../config/db.js';

/**
 * Map raw leave type row to standardized domain model
 */
const mapLeaveTypeRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    code: row.code,
    description: row.description || '',
    daysPerYear: parseFloat(row.days_per_year) || 0.0,
    isPaid: Boolean(row.is_paid),
    requiresApproval: Boolean(row.requires_approval),
    carryForwardDays: parseFloat(row.carry_forward_days) || 0.0,
    genderEligibility: row.gender_eligibility || 'ALL',
    status: row.status || 'Active',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

/**
 * Map raw leave balance row
 */
const mapLeaveBalanceRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    leaveTypeName: row.lt_name || '',
    leaveTypeCode: row.lt_code || '',
    leaveType: {
      id: row.leave_type_id,
      name: row.lt_name || '',
      code: row.lt_code || '',
    },
    year: row.year,
    allocatedDays: parseFloat(row.allocated_days) || 0.0,
    usedDays: parseFloat(row.used_days) || 0.0,
    pendingDays: parseFloat(row.pending_days) || 0.0,
    remainingDays: parseFloat(row.remaining_days) || 0.0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

/**
 * Map raw leave request row
 */
const mapLeaveRequestRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    leaveTypeId: row.leave_type_id,
    startDate: row.start_date,
    endDate: row.end_date,
    isHalfDay: Boolean(row.is_half_day),
    halfDayPeriod: row.half_day_period || null,
    totalDays: parseFloat(row.total_days) || 0.0,
    reason: row.reason || '',
    status: row.status || 'PENDING',
    appliedDate: row.applied_date ? new Date(row.applied_date).toISOString() : null,
    approverId: row.approver_id || null,
    approverUserId: row.approver_user_id || null,
    actionDate: row.action_date ? new Date(row.action_date).toISOString() : null,
    rejectionReason: row.rejection_reason || '',
    cancellationReason: row.cancellation_reason || '',
    cancelledAt: row.cancelled_at ? new Date(row.cancelled_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    // Joined Leave Type
    leaveType: row.lt_id
      ? {
          id: row.lt_id,
          name: row.lt_name,
          code: row.lt_code,
          isPaid: Boolean(row.lt_is_paid),
        }
      : null,
    // Joined Employee
    employee: row.emp_id
      ? {
          id: row.emp_id,
          employeeCode: row.emp_code,
          firstName: row.emp_first_name,
          lastName: row.emp_last_name,
          email: row.emp_email,
          deptId: row.emp_dept_id,
          managerId: row.emp_manager_id || null,
          departmentName: row.dept_name || '',
          designationTitle: row.desig_title || '',
          avatarUrl: row.emp_avatar_url || null,
        }
      : null,
    // Joined Approver
    approver: row.appr_id
      ? {
          id: row.appr_id,
          firstName: row.appr_first_name,
          lastName: row.appr_last_name,
          email: row.appr_email,
          avatarUrl: row.appr_avatar_url || null,
        }
      : null,
  };
};

const BASE_LEAVE_REQUEST_SELECT = `
  SELECT
    lr.id,
    lr.org_id,
    lr.employee_id,
    lr.leave_type_id,
    TO_CHAR(lr.start_date, 'YYYY-MM-DD') AS start_date,
    TO_CHAR(lr.end_date, 'YYYY-MM-DD') AS end_date,
    lr.is_half_day,
    lr.half_day_period,
    lr.total_days,
    lr.reason,
    lr.status,
    lr.applied_date,
    lr.approver_id,
    lr.approver_user_id,
    lr.action_date,
    lr.rejection_reason,
    lr.cancellation_reason,
    lr.cancelled_at,
    lr.created_at,
    lr.updated_at,
    lt.id AS lt_id,
    lt.name AS lt_name,
    lt.code AS lt_code,
    lt.is_paid AS lt_is_paid,
    e.id AS emp_id,
    e.employee_code AS emp_code,
    e.first_name AS emp_first_name,
    e.last_name AS emp_last_name,
    e.email AS emp_email,
    e.dept_id AS emp_dept_id,
    e.manager_id AS emp_manager_id,
    e.avatar_url AS emp_avatar_url,
    d.name AS dept_name,
    ds.title AS desig_title,
    ae.id AS appr_id,
    ae.first_name AS appr_first_name,
    ae.last_name AS appr_last_name,
    ae.email AS appr_email,
    ae.avatar_url AS appr_avatar_url
  FROM leave_requests lr
  JOIN leave_types lt ON lt.id = lr.leave_type_id
  JOIN employees e ON e.id = lr.employee_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN designations ds ON ds.id = e.desig_id
  LEFT JOIN employees ae ON ae.id = lr.approver_id
`;

export const leaveRepository = {
  /**
   * Find all active leave types for an organization
   */
  async findLeaveTypes(orgId, gender = null) {
    let sql = `
      SELECT * FROM leave_types
      WHERE (org_id = $1 OR org_id = 'org-1') AND status = 'Active'
    `;
    const values = [orgId || 'org-1'];
    if (gender) {
      const normGender = String(gender).trim().toUpperCase();
      sql += ` AND (
        gender_eligibility = 'ALL'
        OR (gender_eligibility = 'FEMALE' AND $2 = 'FEMALE')
        OR (gender_eligibility = 'MALE' AND $2 = 'MALE')
      )`;
      values.push(normGender);
    }
    sql += `
      ORDER BY 
        CASE 
          WHEN UPPER(code) = 'PL' THEN 1
          WHEN UPPER(code) = 'CL' THEN 2
          WHEN UPPER(code) = 'SL' THEN 3
          WHEN UPPER(code) = 'HL' THEN 4
          WHEN UPPER(code) = 'HDL' THEN 5
          WHEN UPPER(code) = 'AWOL' THEN 6
          WHEN UPPER(code) = 'LOP' THEN 7
          WHEN UPPER(code) = 'ML' THEN 8
          WHEN UPPER(code) = 'SBL' THEN 9
          WHEN UPPER(code) = 'PTL' THEN 10
          ELSE 11
        END,
        name ASC;
    `;
    const res = await pool.query(sql, values);
    return res.rows.map(mapLeaveTypeRow);
  },

  /**
   * Find active non-optional holidays for an organization within a date range
   */
  async findActiveHolidaysBetween(orgId, startDate, endDate) {
    const sql = `
      SELECT
        id,
        org_id,
        name,
        TO_CHAR(holiday_date, 'YYYY-MM-DD') AS holiday_date,
        holiday_type,
        is_optional,
        description
      FROM holidays
      WHERE org_id = $1
        AND status = 'Active'
        AND is_optional = FALSE
        AND holiday_date >= $2::date
        AND holiday_date <= $3::date
      ORDER BY holiday_date ASC;
    `;
    const res = await pool.query(sql, [orgId, startDate, endDate]);
    return res.rows;
  },

  /**
   * Find leave type by ID or Code
   */
  async findLeaveTypeById(id, orgId = null) {
    let sql = `
      SELECT * FROM leave_types 
      WHERE (
        id = $1 
        OR LOWER(id) = LOWER($1) 
        OR LOWER(code) = LOWER($1) 
        OR LOWER(name) = LOWER($1)
      )
    `;
    const values = [id];
    if (orgId) {
      sql += ' AND (org_id = $2 OR org_id = \'org-1\')';
      values.push(orgId);
    }
    sql += ' ORDER BY CASE WHEN org_id = $2 THEN 0 ELSE 1 END, status ASC LIMIT 1;';
    const res = await pool.query(sql, orgId ? [id, orgId] : [id]);
    return res.rows.length > 0 ? mapLeaveTypeRow(res.rows[0]) : null;
  },

  /**
   * Create a new leave request
   */
  async createLeaveRequest(data) {
    const id = data.id || `lr-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orgId = data.orgId;
    const employeeId = data.employeeId;
    const leaveTypeId = data.leaveTypeId;
    const startDate = data.startDate;
    const endDate = data.endDate;
    const isHalfDay = Boolean(data.isHalfDay);
    const halfDayPeriod = isHalfDay ? data.halfDayPeriod || 'FIRST_HALF' : null;
    const totalDays = Number(data.totalDays);
    const reason = data.reason.trim();
    const status = 'PENDING';
    const appliedDate = new Date();

    const sql = `
      INSERT INTO leave_requests (
        id, org_id, employee_id, leave_type_id,
        start_date, end_date, is_half_day, half_day_period,
        total_days, reason, status, applied_date
      ) VALUES (
        $1, $2, $3, $4,
        $5::date, $6::date, $7, $8,
        $9, $10, $11, $12
      )
      RETURNING id;
    `;

    await pool.query(sql, [
      id,
      orgId,
      employeeId,
      leaveTypeId,
      startDate,
      endDate,
      isHalfDay,
      halfDayPeriod,
      totalDays,
      reason,
      status,
      appliedDate,
    ]);

    return this.findById(id, orgId);
  },

  /**
   * Find leave request by ID
   */
  async findById(id, orgId = null) {
    if (!id || typeof id !== 'string') return null;

    let sql = `
      ${BASE_LEAVE_REQUEST_SELECT}
      WHERE lr.id = $1
    `;
    const values = [id];

    if (orgId) {
      sql += ' AND lr.org_id = $2';
      values.push(orgId);
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapLeaveRequestRow(res.rows[0]) : null;
  },

  /**
   * Check for overlapping leave requests
   */
  async checkOverlappingLeave(employeeId, startDate, endDate, isHalfDay = false, halfDayPeriod = null, excludeId = null) {
    let sql = `
      SELECT id, status, start_date, end_date, is_half_day, half_day_period
      FROM leave_requests
      WHERE employee_id = $1
        AND status IN ('PENDING', 'APPROVED')
        AND start_date <= $3::date
        AND end_date >= $2::date
    `;
    const values = [employeeId, startDate, endDate];
    let paramIndex = 4;

    if (excludeId) {
      sql += ` AND id <> $${paramIndex++}`;
      values.push(excludeId);
    }

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;

    // Evaluate potential half-day overlap specifics
    for (const row of res.rows) {
      if (!isHalfDay || !row.is_half_day) {
        return row; // Full day overlaps with full day or half day
      }
      // Both are half-day: only overlap if on same date and same period
      if (startDate === row.start_date && halfDayPeriod === row.half_day_period) {
        return row;
      }
    }

    return null;
  },

  /**
   * Find employee's own leave history
   */
  async findByEmployee(employeeId, orgId, { status = '', year = '', page = 1, limit = 20 } = {}) {
    const conditions = ['lr.employee_id = $1', 'lr.org_id = $2'];
    const values = [employeeId, orgId];
    let paramIndex = 3;

    if (status) {
      conditions.push(`UPPER(lr.status) = UPPER($${paramIndex++})`);
      values.push(status);
    }

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM lr.start_date) = $${paramIndex++}`);
      values.push(parseInt(year, 10));
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*)::int AS total FROM leave_requests lr ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_LEAVE_REQUEST_SELECT}
      ${whereClause}
      ORDER BY lr.applied_date DESC, lr.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const records = listRes.rows.map(mapLeaveRequestRow);

    return {
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Find team leaves for department manager or direct reports manager
   */
  async findTeamLeaves(deptId, orgId, { status = '', search = '', startDate = '', endDate = '', page = 1, limit = 20, managerId = null } = {}) {
    const conditions = ['lr.org_id = $1'];
    const values = [orgId];
    let paramIndex = 2;

    if (managerId) {
      conditions.push(`e.manager_id = $${paramIndex++}`);
      values.push(managerId);
      // Exclude manager's own personal requests from team approvals list
      conditions.push(`lr.employee_id != $${paramIndex++}`);
      values.push(managerId);
      if (deptId) {
        conditions.push(`e.dept_id = $${paramIndex++}`);
        values.push(deptId);
      }
    } else if (deptId) {
      conditions.push(`e.dept_id = $${paramIndex++}`);
      values.push(deptId);
    }

    if (status === 'ON_LEAVE_TODAY') {
      conditions.push(`UPPER(lr.status) = 'APPROVED'`);
      conditions.push(`lr.start_date <= CURRENT_DATE AND lr.end_date >= CURRENT_DATE`);
    } else if (status) {
      conditions.push(`UPPER(lr.status) = UPPER($${paramIndex++})`);
      values.push(status);
    }

    if (startDate) {
      conditions.push(`lr.end_date >= $${paramIndex++}::date`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`lr.start_date <= $${paramIndex++}::date`);
      values.push(endDate);
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(`(
        LOWER(e.first_name) LIKE $${paramIndex} OR
        LOWER(e.last_name) LIKE $${paramIndex} OR
        LOWER(e.employee_code) LIKE $${paramIndex} OR
        LOWER(e.email) LIKE $${paramIndex}
      )`);
      values.push(q);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_LEAVE_REQUEST_SELECT}
      ${whereClause}
      ORDER BY lr.applied_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const records = listRes.rows.map(mapLeaveRequestRow);

    return {
      records,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Get real-time KPI statistics for team or organization leaves
   */
  async getTeamLeaveStats(deptId, orgId, { managerId = null } = {}) {
    const conditions = ['lr.org_id = $1'];
    const values = [orgId];
    let paramIndex = 2;

    if (managerId) {
      conditions.push(`e.manager_id = $${paramIndex++}`);
      values.push(managerId);
      conditions.push(`lr.employee_id != $${paramIndex++}`);
      values.push(managerId);
      if (deptId) {
        conditions.push(`e.dept_id = $${paramIndex++}`);
        values.push(deptId);
      }
    } else if (deptId) {
      conditions.push(`e.dept_id = $${paramIndex++}`);
      values.push(deptId);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const statsSql = `
      SELECT 
        COUNT(lr.id) FILTER (WHERE UPPER(lr.status) = 'PENDING')::int AS "pending",
        COUNT(lr.id) FILTER (WHERE UPPER(lr.status) = 'APPROVED')::int AS "approved",
        COUNT(lr.id) FILTER (WHERE UPPER(lr.status) = 'REJECTED')::int AS "rejected",
        COUNT(lr.id) FILTER (WHERE UPPER(lr.status) = 'CANCELLED')::int AS "cancelled",
        COUNT(lr.id)::int AS "total",
        COUNT(DISTINCT lr.employee_id) FILTER (
          WHERE UPPER(lr.status) = 'APPROVED' 
            AND lr.start_date <= CURRENT_DATE 
            AND lr.end_date >= CURRENT_DATE
        )::int AS "onLeaveToday"
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      ${whereClause};
    `;

    const res = await pool.query(statsSql, values);
    const row = res.rows[0] || {};
    return {
      pending: row.pending || 0,
      approved: row.approved || 0,
      rejected: row.rejected || 0,
      cancelled: row.cancelled || 0,
      total: row.total || 0,
      onLeaveToday: row.onLeaveToday || 0,
    };
  },

  /**
   * Find organization-wide leaves for HR and Admin
   */
  async findAllOrgLeaves(orgId, { status = '', deptId = '', leaveTypeId = '', search = '', startDate = '', endDate = '', page = 1, limit = 20 } = {}) {
    const conditions = ['lr.org_id = $1'];
    const values = [orgId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`UPPER(lr.status) = UPPER($${paramIndex++})`);
      values.push(status);
    }

    if (deptId) {
      conditions.push(`e.dept_id = $${paramIndex++}`);
      values.push(deptId);
    }

    if (leaveTypeId) {
      conditions.push(`lr.leave_type_id = $${paramIndex++}`);
      values.push(leaveTypeId);
    }

    if (startDate) {
      conditions.push(`lr.end_date >= $${paramIndex++}::date`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`lr.start_date <= $${paramIndex++}::date`);
      values.push(endDate);
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(`(
        LOWER(e.first_name) LIKE $${paramIndex} OR
        LOWER(e.last_name) LIKE $${paramIndex} OR
        LOWER(e.employee_code) LIKE $${paramIndex} OR
        LOWER(e.email) LIKE $${paramIndex}
      )`);
      values.push(q);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM leave_requests lr
      JOIN employees e ON e.id = lr.employee_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    // Summary stats
    const statsSql = `
      SELECT
        COUNT(*) FILTER (WHERE lr.status = 'PENDING')::int AS "pendingCount",
        COUNT(*) FILTER (WHERE lr.status = 'APPROVED')::int AS "approvedCount",
        COUNT(*) FILTER (WHERE lr.status = 'REJECTED')::int AS "rejectedCount",
        COUNT(*) FILTER (WHERE lr.status = 'CANCELLED')::int AS "cancelledCount"
      FROM leave_requests lr
      WHERE lr.org_id = $1;
    `;
    const statsRes = await pool.query(statsSql, [orgId]);
    const summary = statsRes.rows[0] || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_LEAVE_REQUEST_SELECT}
      ${whereClause}
      ORDER BY lr.applied_date DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const records = listRes.rows.map(mapLeaveRequestRow);

    return {
      records,
      summary,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Update status & audit info of a leave request
   */
  async updateStatus(id, { status, approverId = null, approverUserId = null, rejectionReason = '', cancellationReason = '', cancelledAt = null }) {
    const setClauses = ['status = $1', 'updated_at = NOW()'];
    const values = [status];
    let paramIndex = 2;

    if (status === 'APPROVED' || status === 'REJECTED') {
      setClauses.push(`action_date = NOW()`);
      if (approverId !== undefined) {
        setClauses.push(`approver_id = $${paramIndex++}`);
        values.push(approverId);
      }
      if (approverUserId !== undefined) {
        setClauses.push(`approver_user_id = $${paramIndex++}`);
        values.push(approverUserId);
      }
    }

    if (status === 'REJECTED') {
      setClauses.push(`rejection_reason = $${paramIndex++}`);
      values.push(rejectionReason);
    }

    if (status === 'CANCELLED') {
      setClauses.push(`cancelled_at = $${paramIndex++}`);
      values.push(cancelledAt || new Date());
      setClauses.push(`cancellation_reason = $${paramIndex++}`);
      values.push(cancellationReason || '');
    }

    values.push(id);
    const sql = `
      UPDATE leave_requests
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id;
    `;

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;

    return this.findById(id);
  },

  /**
   * Fetch leave balances for an employee in a given year, filtered by gender eligibility
   */
  async getLeaveBalances(employeeId, year = new Date().getFullYear(), gender = null) {
    let normGender = gender ? String(gender).trim().toUpperCase() : null;
    if (!normGender) {
      const empRes = await pool.query('SELECT gender FROM employees WHERE id = $1', [employeeId]);
      normGender = empRes.rows[0]?.gender ? String(empRes.rows[0].gender).toUpperCase() : 'MALE';
    }

    const sql = `
      SELECT
        lb.*,
        lt.name AS lt_name,
        lt.code AS lt_code,
        lt.gender_eligibility AS lt_gender_eligibility
      FROM leave_balances lb
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      WHERE lb.employee_id = $1 AND lb.year = $2 AND lt.status = 'Active'
        AND (
          lt.gender_eligibility = 'ALL'
          OR (lt.gender_eligibility = 'FEMALE' AND $3 = 'FEMALE')
          OR (lt.gender_eligibility = 'MALE' AND $3 = 'MALE')
        )
      ORDER BY 
        CASE 
          WHEN UPPER(lt.code) = 'PL' THEN 1
          WHEN UPPER(lt.code) = 'CL' THEN 2
          WHEN UPPER(lt.code) = 'SL' THEN 3
          WHEN UPPER(lt.code) = 'HL' THEN 4
          WHEN UPPER(lt.code) = 'HDL' THEN 5
          WHEN UPPER(lt.code) = 'AWOL' THEN 6
          WHEN UPPER(lt.code) = 'LOP' THEN 7
          WHEN UPPER(lt.code) = 'ML' THEN 8
          WHEN UPPER(lt.code) = 'SBL' THEN 9
          WHEN UPPER(lt.code) = 'PTL' THEN 10
          ELSE 11
        END,
        lt.name ASC;
    `;
    const res = await pool.query(sql, [employeeId, year, normGender]);
    return res.rows.map(mapLeaveBalanceRow);
  },

  /**
   * Create a new custom leave type
   */
  async createLeaveType(data) {
    const id = data.id || `lt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orgId = data.orgId || 'org-1';
    const name = data.name.trim();
    const code = (data.code || name.replace(/[^a-zA-Z]/g, '').slice(0, 4)).toUpperCase();
    const description = data.description || '';
    const daysPerYear = parseFloat(data.daysPerYear) || 0.0;
    const isPaid = data.isPaid !== undefined ? Boolean(data.isPaid) : true;
    const requiresApproval = data.requiresApproval !== undefined ? Boolean(data.requiresApproval) : true;
    const carryForwardDays = parseFloat(data.carryForwardDays) || 0.0;
    const genderEligibility = (data.genderEligibility || 'ALL').toUpperCase();

    const sql = `
      INSERT INTO leave_types (
        id, org_id, name, code, description,
        days_per_year, is_paid, requires_approval, carry_forward_days, gender_eligibility, status,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10, 'Active',
        NOW(), NOW()
      )
      ON CONFLICT (org_id, code) DO UPDATE
      SET name = EXCLUDED.name,
          description = EXCLUDED.description,
          days_per_year = EXCLUDED.days_per_year,
          is_paid = EXCLUDED.is_paid,
          requires_approval = EXCLUDED.requires_approval,
          carry_forward_days = EXCLUDED.carry_forward_days,
          gender_eligibility = EXCLUDED.gender_eligibility,
          status = 'Active',
          updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id, orgId, name, code, description,
      daysPerYear, isPaid, requiresApproval, carryForwardDays, genderEligibility
    ]);
    return mapLeaveTypeRow(res.rows[0]);
  },

  /**
   * Initialize leave balances for employee if missing
   */
  async initializeBalancesForEmployee(employeeId, orgId, year = new Date().getFullYear(), gender = null) {
    let normGender = gender ? String(gender).trim().toUpperCase() : null;
    if (!normGender) {
      const empRes = await pool.query('SELECT gender FROM employees WHERE id = $1', [employeeId]);
      normGender = empRes.rows[0]?.gender ? String(empRes.rows[0].gender).toUpperCase() : 'MALE';
    }

    const types = await this.findLeaveTypes(orgId);
    for (const lt of types) {
      if (lt.genderEligibility === 'FEMALE' && normGender === 'MALE') continue;
      if (lt.genderEligibility === 'MALE' && normGender === 'FEMALE') continue;

      const balanceId = `lb-${employeeId}-${lt.id}-${year}`;
      const sql = `
        INSERT INTO leave_balances (id, org_id, employee_id, leave_type_id, year, allocated_days, used_days, pending_days)
        VALUES ($1, $2, $3, $4, $5, $6, 0.0, 0.0)
        ON CONFLICT (employee_id, leave_type_id, year) DO NOTHING;
      `;
      await pool.query(sql, [balanceId, orgId, employeeId, lt.id, year, lt.daysPerYear]);
    }
    return this.getLeaveBalances(employeeId, year, normGender);
  },

  /**
   * Adjust employee leave balance
   */
  async adjustBalance(employeeId, leaveTypeId, year, { pendingDelta = 0, usedDelta = 0 }) {
    const sql = `
      UPDATE leave_balances
      SET
        pending_days = GREATEST(0.0, pending_days + $1),
        used_days = GREATEST(0.0, used_days + $2),
        updated_at = NOW()
      WHERE employee_id = $3 AND leave_type_id = $4 AND year = $5
      RETURNING *;
    `;
    const res = await pool.query(sql, [pendingDelta, usedDelta, employeeId, leaveTypeId, year]);
    return res.rows.length > 0 ? mapLeaveBalanceRow(res.rows[0]) : null;
  },

  /**
   * Set or update custom leave allocations for an employee
   */
  async setEmployeeLeaveAllocations(employeeId, orgId, year = new Date().getFullYear(), allocations = {}) {
    const empRes = await pool.query('SELECT gender FROM employees WHERE id = $1', [employeeId]);
    const normGender = empRes.rows[0]?.gender ? String(empRes.rows[0].gender).toUpperCase() : 'MALE';

    const types = await this.findLeaveTypes(orgId);
    const typeMap = new Map(types.map((t) => [t.id, t]));

    let list = [];
    if (Array.isArray(allocations)) {
      list = allocations.map((a) => ({
        leaveTypeId: a.leaveTypeId || a.id,
        days: parseFloat(a.days ?? a.allocatedDays ?? 0),
      }));
    } else if (allocations && typeof allocations === 'object') {
      list = Object.entries(allocations).map(([leaveTypeId, days]) => ({
        leaveTypeId,
        days: parseFloat(days ?? 0),
      }));
    }

    for (const item of list) {
      if (!item.leaveTypeId || isNaN(item.days)) continue;
      const lt = typeMap.get(item.leaveTypeId);
      if (lt) {
        if (lt.genderEligibility === 'FEMALE' && normGender === 'MALE') continue;
        if (lt.genderEligibility === 'MALE' && normGender === 'FEMALE') continue;
      }

      const balanceId = `lb-${employeeId}-${item.leaveTypeId}-${year}`;
      const sql = `
        INSERT INTO leave_balances (id, org_id, employee_id, leave_type_id, year, allocated_days, used_days, pending_days, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, 0.0, 0.0, NOW())
        ON CONFLICT (employee_id, leave_type_id, year)
        DO UPDATE SET allocated_days = EXCLUDED.allocated_days, updated_at = NOW();
      `;
      await pool.query(sql, [balanceId, orgId, employeeId, item.leaveTypeId, year, Math.max(0, item.days)]);
    }

    return this.getLeaveBalances(employeeId, year, normGender);
  },

  /**
   * Fetch leave balances for all active employees (Admin / HR)
   */
  async getAllEmployeesBalances(orgId, year = new Date().getFullYear()) {
    const sql = `
      SELECT
        e.id AS employee_id,
        e.employee_code,
        e.first_name,
        e.last_name,
        e.email,
        e.avatar_url,
        e.gender,
        d.name AS department_name,
        des.title AS designation_title,
        lb.id AS balance_id,
        lb.leave_type_id,
        lt.name AS leave_type_name,
        lt.code AS leave_type_code,
        lb.allocated_days,
        lb.used_days,
        lb.pending_days,
        lb.remaining_days
      FROM employees e
      LEFT JOIN departments d ON d.id = e.dept_id
      LEFT JOIN designations des ON des.id = e.designation_id
      LEFT JOIN leave_balances lb ON lb.employee_id = e.id AND lb.year = $2
      LEFT JOIN leave_types lt ON lt.id = lb.leave_type_id AND lt.status = 'Active'
      WHERE (e.org_id = $1 OR $1 IS NULL) AND e.status = 'Active'
      ORDER BY e.first_name ASC, e.last_name ASC, 
        CASE 
          WHEN UPPER(lt.code) = 'PL' THEN 1
          WHEN UPPER(lt.code) = 'CL' THEN 2
          WHEN UPPER(lt.code) = 'SL' THEN 3
          WHEN UPPER(lt.code) = 'HL' THEN 4
          WHEN UPPER(lt.code) = 'HDL' THEN 5
          ELSE 6
        END,
        lt.name ASC;
    `;
    const res = await pool.query(sql, [orgId, year]);

    const empMap = new Map();
    for (const row of res.rows) {
      if (!empMap.has(row.employee_id)) {
        empMap.set(row.employee_id, {
          id: row.employee_id,
          employeeId: row.employee_id,
          employeeCode: row.employee_code || '',
          firstName: row.first_name || '',
          lastName: row.last_name || '',
          fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          email: row.email || '',
          avatarUrl: row.avatar_url || null,
          gender: row.gender,
          departmentName: row.department_name || '',
          designationTitle: row.designation_title || '',
          balances: [],
        });
      }
      if (row.balance_id && row.leave_type_id) {
        empMap.get(row.employee_id).balances.push({
          id: row.balance_id,
          leaveTypeId: row.leave_type_id,
          leaveTypeName: row.leave_type_name || '',
          leaveTypeCode: row.leave_type_code || '',
          allocatedDays: parseFloat(row.allocated_days) || 0.0,
          usedDays: parseFloat(row.used_days) || 0.0,
          pendingDays: parseFloat(row.pending_days) || 0.0,
          remainingDays: parseFloat(row.remaining_days) || 0.0,
        });
      }
    }
    return Array.from(empMap.values());
  },
};
