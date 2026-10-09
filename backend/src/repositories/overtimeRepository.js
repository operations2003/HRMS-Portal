import { pool } from '../config/db.js';

/**
 * Maps raw database row to clean camelCase entity
 */
const mapOvertimeRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    attendanceRecordId: row.attendance_record_id || null,
    overtimeDate: row.overtime_date ? new Date(row.overtime_date).toISOString().split('T')[0] : null,
    startTime: row.start_time ? new Date(row.start_time).toISOString() : null,
    endTime: row.end_time ? new Date(row.end_time).toISOString() : null,
    durationHours: parseFloat(row.duration_hours) || 0.0,
    durationMinutes: parseInt(row.duration_minutes, 10) || 0,
    status: row.status || 'IN_PROGRESS',
    notes: row.notes || '',
    source: row.source || 'WEB',
    ipAddress: row.ip_address || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    employee: row.emp_first_name ? {
      id: row.employee_id,
      employeeCode: row.emp_code,
      firstName: row.emp_first_name,
      lastName: row.emp_last_name,
      email: row.emp_email,
      avatarUrl: row.emp_avatar_url || null,
    } : undefined,
  };
};

const BASE_OVERTIME_SELECT = `
  SELECT 
    o.id,
    o.org_id,
    o.employee_id,
    o.attendance_record_id,
    o.overtime_date,
    o.start_time,
    o.end_time,
    o.duration_hours,
    o.duration_minutes,
    o.status,
    o.notes,
    o.source,
    o.ip_address,
    o.created_at,
    o.updated_at,
    e.employee_code AS emp_code,
    e.first_name AS emp_first_name,
    e.last_name AS emp_last_name,
    e.email AS emp_email,
    e.avatar_url AS emp_avatar_url
  FROM overtime_records o
  JOIN employees e ON e.id = o.employee_id
`;

export const overtimeRepository = {
  /**
   * Create new overtime record
   */
  async create(data) {
    const id = data.id || `ot-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const sql = `
      INSERT INTO overtime_records (
        id, org_id, employee_id, attendance_record_id,
        overtime_date, start_time, end_time,
        duration_hours, duration_minutes, status,
        notes, source, ip_address, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5::date, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *;
    `;
    const values = [
      id,
      data.orgId,
      data.employeeId,
      data.attendanceRecordId || null,
      data.overtimeDate,
      data.startTime,
      data.endTime || null,
      data.durationHours || 0.0,
      data.durationMinutes || 0,
      data.status || 'IN_PROGRESS',
      data.notes || '',
      data.source || 'WEB',
      data.ipAddress || '',
    ];
    const res = await pool.query(sql, values);
    return mapOvertimeRow(res.rows[0]);
  },

  /**
   * Find an active in-progress overtime session for employee
   */
  async findActiveByEmployee(employeeId, orgId = null) {
    if (!employeeId) return null;
    let sql = `
      ${BASE_OVERTIME_SELECT}
      WHERE o.employee_id = $1 AND o.status = 'IN_PROGRESS'
    `;
    const values = [employeeId];
    if (orgId) {
      sql += ' AND o.org_id = $2';
      values.push(orgId);
    }
    sql += ' ORDER BY o.start_time DESC LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapOvertimeRow(res.rows[0]) : null;
  },

  /**
   * Find overtime records for an employee on a specific date
   */
  async findByEmployeeAndDate(employeeId, overtimeDate, orgId = null) {
    if (!employeeId || !overtimeDate) return [];
    let sql = `
      ${BASE_OVERTIME_SELECT}
      WHERE o.employee_id = $1 AND o.overtime_date = $2::date
    `;
    const values = [employeeId, overtimeDate];
    if (orgId) {
      sql += ' AND o.org_id = $3';
      values.push(orgId);
    }
    sql += ' ORDER BY o.start_time DESC;';
    const res = await pool.query(sql, values);
    return res.rows.map(mapOvertimeRow);
  },

  /**
   * Find single overtime record by ID
   */
  async findById(id, orgId = null) {
    if (!id) return null;
    let sql = `
      ${BASE_OVERTIME_SELECT}
      WHERE o.id = $1
    `;
    const values = [id];
    if (orgId) {
      sql += ' AND o.org_id = $2';
      values.push(orgId);
    }
    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapOvertimeRow(res.rows[0]) : null;
  },

  /**
   * Update overtime record (e.g. on logout/end session)
   */
  async update(id, data) {
    if (!id || !data) return null;
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (data.endTime !== undefined) {
      setClauses.push(`end_time = $${paramIndex++}`);
      values.push(data.endTime);
    }
    if (data.durationHours !== undefined) {
      setClauses.push(`duration_hours = $${paramIndex++}`);
      values.push(Number(data.durationHours) || 0.0);
    }
    if (data.durationMinutes !== undefined) {
      setClauses.push(`duration_minutes = $${paramIndex++}`);
      values.push(parseInt(data.durationMinutes, 10) || 0);
    }
    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }
    if (data.notes !== undefined) {
      setClauses.push(`notes = $${paramIndex++}`);
      values.push(data.notes);
    }
    if (data.attendanceRecordId !== undefined) {
      setClauses.push(`attendance_record_id = $${paramIndex++}`);
      values.push(data.attendanceRecordId);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);
    const sql = `
      UPDATE overtime_records
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *;
    `;
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapOvertimeRow(res.rows[0]) : null;
  },

  /**
   * Paginated overtime history for employee
   */
  async findHistoryByEmployee(employeeId, orgId = null, { page = 1, limit = 20, startDate = null, endDate = null } = {}) {
    if (!employeeId) return { records: [], total: 0 };
    const p = Math.max(1, parseInt(page, 10) || 1);
    const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const offset = (p - 1) * l;

    let whereSql = `WHERE o.employee_id = $1`;
    const values = [employeeId];
    let idx = 2;

    if (orgId) {
      whereSql += ` AND o.org_id = $${idx++}`;
      values.push(orgId);
    }
    if (startDate) {
      whereSql += ` AND o.overtime_date >= $${idx++}::date`;
      values.push(startDate);
    }
    if (endDate) {
      whereSql += ` AND o.overtime_date <= $${idx++}::date`;
      values.push(endDate);
    }

    const countSql = `SELECT COUNT(*) AS total FROM overtime_records o ${whereSql};`;
    const countRes = await pool.query(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    const dataSql = `
      ${BASE_OVERTIME_SELECT}
      ${whereSql}
      ORDER BY o.overtime_date DESC, o.start_time DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    const dataValues = [...values, l, offset];
    const dataRes = await pool.query(dataSql, dataValues);

    return {
      records: dataRes.rows.map(mapOvertimeRow),
      total,
      page: p,
      limit: l,
      totalPages: Math.ceil(total / l) || 1,
    };
  },
};

