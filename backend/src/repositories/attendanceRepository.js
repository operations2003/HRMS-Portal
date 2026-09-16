import { pool } from '../config/db.js';

/**
 * Maps raw database row to standardized Attendance domain model
 */
const mapAttendanceRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.orgId,
    employeeId: row.employeeId,
    attendanceDate: row.attendanceDate,
    timezone: row.timezone || 'UTC',
    checkIn: row.checkIn ? new Date(row.checkIn).toISOString() : null,
    checkOut: row.checkOut ? new Date(row.checkOut).toISOString() : null,
    totalHours: parseFloat(row.totalHours) || 0.0,
    status: row.status || 'PRESENT',
    shiftId: row.shiftId || null,
    breakDurationMinutes: parseInt(row.breakDurationMinutes, 10) || 0,
    overtimeHours: parseFloat(row.overtimeHours) || 0.0,
    source: row.source || 'WEB',
    ipAddress: row.ipAddress || '',
    location: row.location || {},
    isRegularized: Boolean(row.isRegularized),
    regularizationReason: row.regularizationReason || '',
    regularizedBy: row.regularizedBy || null,
    regularizedAt: row.regularizedAt ? new Date(row.regularizedAt).toISOString() : null,
    notes: row.notes || '',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    // Joined employee information
    employee: row.emp_id
      ? {
          id: row.emp_id,
          employeeCode: row.emp_code,
          firstName: row.emp_first_name,
          lastName: row.emp_last_name,
          email: row.emp_email,
          deptId: row.emp_dept_id,
          departmentName: row.dept_name || '',
          designationTitle: row.desig_title || '',
        }
      : null,
    // Regularizer information if available
    regularizer: row.reg_user_id
      ? {
          id: row.reg_user_id,
          name: `${row.reg_first_name || ''} ${row.reg_last_name || ''}`.trim(),
          email: row.reg_email || '',
        }
      : null,
  };
};

const BASE_ATTENDANCE_SELECT = `
  SELECT
    a.id,
    a.org_id AS "orgId",
    a.employee_id AS "employeeId",
    TO_CHAR(a.attendance_date, 'YYYY-MM-DD') AS "attendanceDate",
    a.timezone,
    a.check_in AS "checkIn",
    a.check_out AS "checkOut",
    a.total_hours AS "totalHours",
    a.status,
    a.shift_id AS "shiftId",
    a.break_duration_minutes AS "breakDurationMinutes",
    a.overtime_hours AS "overtimeHours",
    a.source,
    a.ip_address AS "ipAddress",
    a.location,
    a.is_regularized AS "isRegularized",
    a.regularization_reason AS "regularizationReason",
    a.regularized_by AS "regularizedBy",
    a.regularized_at AS "regularizedAt",
    a.notes,
    a.created_at AS "createdAt",
    a.updated_at AS "updatedAt",
    e.id AS emp_id,
    e.employee_code AS emp_code,
    e.first_name AS emp_first_name,
    e.last_name AS emp_last_name,
    e.email AS emp_email,
    e.dept_id AS emp_dept_id,
    d.name AS dept_name,
    ds.title AS desig_title,
    u.id AS reg_user_id,
    u.first_name AS reg_first_name,
    u.last_name AS reg_last_name,
    u.email AS reg_email
  FROM attendance_records a
  JOIN employees e ON e.id = a.employee_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN designations ds ON ds.id = e.desig_id
  LEFT JOIN users u ON u.id = a.regularized_by
`;

export const attendanceRepository = {
  /**
   * Find attendance record for an employee on a specific date
   */
  async findByEmployeeAndDate(employeeId, attendanceDate, orgId = null) {
    if (!employeeId || !attendanceDate) return null;

    let sql = `
      ${BASE_ATTENDANCE_SELECT}
      WHERE a.employee_id = $1 AND a.attendance_date = $2::date
    `;
    const values = [employeeId, attendanceDate];

    if (orgId) {
      sql += ' AND a.org_id = $3';
      values.push(orgId);
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapAttendanceRow(res.rows[0]) : null;
  },

  /**
   * Find attendance record by ID
   */
  async findById(id, orgId = null) {
    if (!id || typeof id !== 'string') return null;

    let sql = `
      ${BASE_ATTENDANCE_SELECT}
      WHERE a.id = $1
    `;
    const values = [id];

    if (orgId) {
      sql += ' AND a.org_id = $2';
      values.push(orgId);
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapAttendanceRow(res.rows[0]) : null;
  },

  /**
   * Create a new attendance record (Check-In)
   */
  async create(data) {
    const id = data.id || `att-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const orgId = data.orgId;
    const employeeId = data.employeeId;
    const attendanceDate = data.attendanceDate || new Date().toISOString().split('T')[0];
    const timezone = data.timezone || 'UTC';
    const checkIn = data.checkIn || new Date();
    const checkOut = data.checkOut || null;
    const totalHours = Number(data.totalHours) || 0.0;
    const status = data.status || 'PRESENT';
    const shiftId = data.shiftId || null;
    const breakDurationMinutes = parseInt(data.breakDurationMinutes, 10) || 0;
    const overtimeHours = Number(data.overtimeHours) || 0.0;
    const source = data.source || 'WEB';
    const ipAddress = data.ipAddress || '';
    const location = typeof data.location === 'object' ? JSON.stringify(data.location) : '{}';
    const notes = data.notes || '';

    const sql = `
      INSERT INTO attendance_records (
        id, org_id, employee_id, attendance_date, timezone,
        check_in, check_out, total_hours, status, shift_id,
        break_duration_minutes, overtime_hours, source, ip_address,
        location, notes
      ) VALUES (
        $1, $2, $3, $4::date, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14,
        $15::jsonb, $16
      )
      RETURNING id;
    `;

    await pool.query(sql, [
      id,
      orgId,
      employeeId,
      attendanceDate,
      timezone,
      checkIn,
      checkOut,
      totalHours,
      status,
      shiftId,
      breakDurationMinutes,
      overtimeHours,
      source,
      ipAddress,
      location,
      notes,
    ]);

    return this.findById(id, orgId);
  },

  /**
   * Update an existing attendance record (Check-Out, Regularize, Edit)
   */
  async update(id, data) {
    if (!id || typeof id !== 'string') return null;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (data.checkIn !== undefined) {
      setClauses.push(`check_in = $${paramIndex++}`);
      values.push(data.checkIn);
    }

    if (data.checkOut !== undefined) {
      setClauses.push(`check_out = $${paramIndex++}`);
      values.push(data.checkOut);
    }

    if (data.totalHours !== undefined) {
      setClauses.push(`total_hours = $${paramIndex++}`);
      values.push(Number(data.totalHours) || 0.0);
    }

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.breakDurationMinutes !== undefined) {
      setClauses.push(`break_duration_minutes = $${paramIndex++}`);
      values.push(parseInt(data.breakDurationMinutes, 10) || 0);
    }

    if (data.overtimeHours !== undefined) {
      setClauses.push(`overtime_hours = $${paramIndex++}`);
      values.push(Number(data.overtimeHours) || 0.0);
    }

    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }

    if (data.isRegularized !== undefined) {
      setClauses.push(`is_regularized = $${paramIndex++}`);
      values.push(Boolean(data.isRegularized));
    }

    if (data.regularizationReason !== undefined) {
      setClauses.push(`regularization_reason = $${paramIndex++}`);
      values.push(data.regularizationReason);
    }

    if (data.regularizedBy !== undefined) {
      setClauses.push(`regularized_by = $${paramIndex++}`);
      values.push(data.regularizedBy);
    }

    if (data.regularizedAt !== undefined) {
      setClauses.push(`regularized_at = $${paramIndex++}`);
      values.push(data.regularizedAt);
    }

    if (data.location !== undefined) {
      setClauses.push(`location = $${paramIndex++}::jsonb`);
      values.push(typeof data.location === 'object' ? JSON.stringify(data.location) : '{}');
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE attendance_records
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id;
    `;

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;

    return this.findById(id);
  },

  /**
   * Find employee's own attendance history with date filtering and pagination
   */
  async findByEmployeeHistory(employeeId, orgId, { startDate = '', endDate = '', status = '', page = 1, limit = 20 } = {}) {
    const conditions = ['a.employee_id = $1', 'a.org_id = $2'];
    const values = [employeeId, orgId];
    let paramIndex = 3;

    if (startDate) {
      conditions.push(`a.attendance_date >= $${paramIndex++}::date`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`a.attendance_date <= $${paramIndex++}::date`);
      values.push(endDate);
    }

    if (status) {
      conditions.push(`UPPER(a.status) = UPPER($${paramIndex++})`);
      values.push(status);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Total Count
    const countSql = `SELECT COUNT(*)::int AS total FROM attendance_records a ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    // Metrics calculation (present days, total hours, half days, overtime)
    const statsSql = `
      SELECT
        COUNT(*) FILTER (WHERE a.status = 'PRESENT')::int AS "presentDays",
        COUNT(*) FILTER (WHERE a.status = 'HALF_DAY')::int AS "halfDays",
        COUNT(*) FILTER (WHERE a.status = 'LATE')::int AS "lateDays",
        COUNT(*) FILTER (WHERE a.status = 'ABSENT')::int AS "absentDays",
        COALESCE(SUM(a.total_hours), 0)::float AS "totalHoursWorked",
        COALESCE(SUM(a.overtime_hours), 0)::float AS "totalOvertimeHours"
      FROM attendance_records a
      ${whereClause};
    `;
    const statsRes = await pool.query(statsSql, values);
    const stats = statsRes.rows[0] || {};

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_ATTENDANCE_SELECT}
      ${whereClause}
      ORDER BY a.attendance_date DESC, a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const records = listRes.rows.map(mapAttendanceRow);

    return {
      records,
      statistics: {
        presentDays: stats.presentDays || 0,
        halfDays: stats.halfDays || 0,
        lateDays: stats.lateDays || 0,
        absentDays: stats.absentDays || 0,
        totalHoursWorked: parseFloat(Number(stats.totalHoursWorked || 0).toFixed(2)),
        totalOvertimeHours: parseFloat(Number(stats.totalOvertimeHours || 0).toFixed(2)),
        averageHoursPerDay:
          stats.presentDays + stats.halfDays > 0
            ? parseFloat(((stats.totalHoursWorked || 0) / (stats.presentDays + stats.halfDays)).toFixed(2))
            : 0.0,
      },
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Find team attendance for a Manager (scoped by department)
   */
  async findTeamAttendance(deptId, orgId, { date = '', startDate = '', endDate = '', status = '', search = '', page = 1, limit = 20 } = {}) {
    const conditions = ['a.org_id = $1'];
    const values = [orgId];
    let paramIndex = 2;

    if (deptId) {
      conditions.push(`e.dept_id = $${paramIndex++}`);
      values.push(deptId);
    }

    if (date) {
      conditions.push(`a.attendance_date = $${paramIndex++}::date`);
      values.push(date);
    } else {
      if (startDate) {
        conditions.push(`a.attendance_date >= $${paramIndex++}::date`);
        values.push(startDate);
      }
      if (endDate) {
        conditions.push(`a.attendance_date <= $${paramIndex++}::date`);
        values.push(endDate);
      }
    }

    if (status) {
      conditions.push(`UPPER(a.status) = UPPER($${paramIndex++})`);
      values.push(status);
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
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_ATTENDANCE_SELECT}
      ${whereClause}
      ORDER BY a.attendance_date DESC, e.first_name ASC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const records = listRes.rows.map(mapAttendanceRow);

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
   * Find organization-wide attendance records for HR & Admin
   */
  async findAllOrgAttendance(orgId, { date = '', startDate = '', endDate = '', deptId = '', status = '', search = '', page = 1, limit = 20 } = {}) {
    const conditions = ['a.org_id = $1'];
    const values = [orgId];
    let paramIndex = 2;

    if (deptId) {
      conditions.push(`e.dept_id = $${paramIndex++}`);
      values.push(deptId);
    }

    if (date) {
      conditions.push(`a.attendance_date = $${paramIndex++}::date`);
      values.push(date);
    } else {
      if (startDate) {
        conditions.push(`a.attendance_date >= $${paramIndex++}::date`);
        values.push(startDate);
      }
      if (endDate) {
        conditions.push(`a.attendance_date <= $${paramIndex++}::date`);
        values.push(endDate);
      }
    }

    if (status) {
      conditions.push(`UPPER(a.status) = UPPER($${paramIndex++})`);
      values.push(status);
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
      FROM attendance_records a
      JOIN employees e ON e.id = a.employee_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_ATTENDANCE_SELECT}
      ${whereClause}
      ORDER BY a.attendance_date DESC, a.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const records = listRes.rows.map(mapAttendanceRow);

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
   * Aggregates organization-wide daily summary statistics
   */
  async getDailySummary(orgId, date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Query active employee count and attendance summary for the day
    const summarySql = `
      SELECT
        (SELECT COUNT(*)::int FROM employees WHERE org_id = $1 AND status = 'Active') AS "totalEmployees",
        COUNT(a.id) FILTER (WHERE a.status = 'PRESENT')::int AS "presentCount",
        COUNT(a.id) FILTER (WHERE a.status = 'HALF_DAY')::int AS "halfDayCount",
        COUNT(a.id) FILTER (WHERE a.status = 'LATE')::int AS "lateCount",
        COUNT(a.id) FILTER (WHERE a.status = 'ON_LEAVE')::int AS "onLeaveCount",
        COUNT(a.id) FILTER (WHERE a.status = 'ABSENT')::int AS "absentCount",
        COUNT(a.id)::int AS "totalMarked"
      FROM attendance_records a
      WHERE a.org_id = $1 AND a.attendance_date = $2::date;
    `;

    const res = await pool.query(summarySql, [orgId, targetDate]);
    const row = res.rows[0] || {};
    const totalEmployees = row.totalEmployees || 0;
    const totalMarked = row.totalMarked || 0;
    const presentCount = row.presentCount || 0;
    const halfDayCount = row.halfDayCount || 0;
    const onLeaveCount = row.onLeaveCount || 0;
    const lateCount = row.lateCount || 0;

    // Remaining active employees who haven't marked attendance yet
    const pendingCount = Math.max(0, totalEmployees - totalMarked);

    return {
      date: targetDate,
      totalEmployees,
      presentCount,
      halfDayCount,
      lateCount,
      onLeaveCount,
      absentCount: row.absentCount || 0,
      pendingCount,
      attendanceRate: totalEmployees > 0 ? parseFloat((((presentCount + halfDayCount) / totalEmployees) * 100).toFixed(1)) : 0.0,
    };
  },
};
