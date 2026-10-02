import { pool } from '../config/db.js';
import { CEO_ADMIN_EXCLUSION_SQL } from '../utils/roleUtils.js';

const mapDailyReportRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    reportDate: row.report_date ? (row.report_date instanceof Date ? row.report_date.toISOString().split('T')[0] : String(row.report_date).split('T')[0]) : null,
    workSummary: row.work_summary,
    status: row.status || 'SUBMITTED',
    managerFeedback: row.manager_feedback || null,
    reviewedBy: row.reviewed_by || null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    // Joined employee information
    employee: row.emp_id
      ? {
          id: row.emp_id,
          employeeCode: row.emp_code,
          firstName: row.emp_first_name,
          lastName: row.emp_last_name,
          fullName: `${row.emp_first_name || ''} ${row.emp_last_name || ''}`.trim(),
          email: row.emp_email,
          avatarUrl: row.emp_avatar_url || null,
          departmentName: row.dept_name || '',
          designationTitle: row.desig_title || '',
        }
      : null,
    reviewer: row.rev_user_id
      ? {
          id: row.rev_user_id,
          name: `${row.rev_first_name || ''} ${row.rev_last_name || ''}`.trim(),
          email: row.rev_email || '',
        }
      : null,
  };
};

const BASE_REPORT_SELECT = `
  SELECT
    r.id,
    r.org_id,
    r.employee_id,
    TO_CHAR(r.report_date, 'YYYY-MM-DD') AS report_date,
    r.work_summary,
    r.status,
    r.manager_feedback,
    r.reviewed_by,
    r.reviewed_at,
    r.created_at,
    r.updated_at,
    e.id AS emp_id,
    e.employee_code AS emp_code,
    e.first_name AS emp_first_name,
    e.last_name AS emp_last_name,
    e.email AS emp_email,
    e.avatar_url AS emp_avatar_url,
    d.name AS dept_name,
    ds.title AS desig_title,
    u.id AS rev_user_id,
    u.first_name AS rev_first_name,
    u.last_name AS rev_last_name,
    u.email AS rev_email
  FROM daily_work_reports r
  JOIN employees e ON e.id = r.employee_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN designations ds ON ds.id = e.desig_id
  LEFT JOIN users u ON u.id = r.reviewed_by
`;

export const dailyReportRepository = {
  /**
   * Find single report by ID
   */
  async findById(id) {
    const sql = `${BASE_REPORT_SELECT} WHERE r.id = $1 LIMIT 1;`;
    const res = await pool.query(sql, [id]);
    return res.rows.length ? mapDailyReportRow(res.rows[0]) : null;
  },

  /**
   * Find report by Employee and Date
   */
  async findByEmployeeAndDate(employeeId, date, orgId) {
    const sql = `
      ${BASE_REPORT_SELECT}
      WHERE r.employee_id = $1 AND r.report_date = $2::date AND r.org_id = $3
      LIMIT 1;
    `;
    const res = await pool.query(sql, [employeeId, date, orgId]);
    return res.rows.length ? mapDailyReportRow(res.rows[0]) : null;
  },

  /**
   * Upsert Daily Work Report (Create or Update today's report)
   */
  async upsertReport(data) {
    const id = data.id || `dwr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const reportDate = data.reportDate || new Date().toISOString().split('T')[0];

    const sql = `
      INSERT INTO daily_work_reports (
        id, org_id, employee_id, report_date, work_summary, status, updated_at
      ) VALUES ($1, $2, $3, $4::date, $5, $6, NOW())
      ON CONFLICT (employee_id, report_date) DO UPDATE SET
        work_summary = EXCLUDED.work_summary,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id;
    `;

    const values = [
      id,
      data.orgId,
      data.employeeId,
      reportDate,
      data.workSummary,
      data.status || 'SUBMITTED',
    ];

    const res = await pool.query(sql, values);
    const savedId = res.rows[0]?.id || id;
    return this.findById(savedId);
  },

  /**
   * Find employee's own report history
   */
  async findByEmployeeHistory(employeeId, orgId, { startDate = '', endDate = '', page = 1, limit = 20 } = {}) {
    const conditions = ['r.employee_id = $1', 'r.org_id = $2'];
    const values = [employeeId, orgId];
    let pIdx = 3;

    if (startDate) {
      conditions.push(`r.report_date >= $${pIdx++}::date`);
      values.push(startDate);
    }
    if (endDate) {
      conditions.push(`r.report_date <= $${pIdx++}::date`);
      values.push(endDate);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `SELECT COUNT(*)::int AS total FROM daily_work_reports r ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_REPORT_SELECT}
      ${whereClause}
      ORDER BY r.report_date DESC, r.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    return {
      records: listRes.rows.map(mapDailyReportRow),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Find team/org daily work reports (with search and filtering)
   */
  async findTeamReports({
    orgId,
    managerId = null,
    deptId = '',
    date = '',
    startDate = '',
    endDate = '',
    status = '',
    search = '',
    hasBlocker = false,
    page = 1,
    limit = 20,
  } = {}) {
    const conditions = ['r.org_id = $1', CEO_ADMIN_EXCLUSION_SQL];
    const values = [orgId];
    let pIdx = 2;

    if (managerId) {
      conditions.push(`e.manager_id = $${pIdx++}`);
      values.push(managerId);
    }

    if (deptId) {
      conditions.push(`e.dept_id = $${pIdx++}`);
      values.push(deptId);
    }

    if (date) {
      conditions.push(`r.report_date = $${pIdx++}::date`);
      values.push(date);
    } else {
      if (startDate) {
        conditions.push(`r.report_date >= $${pIdx++}::date`);
        values.push(startDate);
      }
      if (endDate) {
        conditions.push(`r.report_date <= $${pIdx++}::date`);
        values.push(endDate);
      }
    }

    if (status) {
      conditions.push(`r.status = $${pIdx++}`);
      values.push(status.toUpperCase());
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(`(
        LOWER(e.first_name) LIKE $${pIdx} OR
        LOWER(e.last_name) LIKE $${pIdx} OR
        LOWER(e.employee_code) LIKE $${pIdx} OR
        LOWER(r.work_summary) LIKE $${pIdx}
      )`);
      values.push(q);
      pIdx++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    const countSql = `
      SELECT COUNT(*)::int AS total
      FROM daily_work_reports r
      JOIN employees e ON e.id = r.employee_id
      ${whereClause};
    `;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_REPORT_SELECT}
      ${whereClause}
      ORDER BY r.report_date DESC, r.created_at DESC
      LIMIT $${pIdx++} OFFSET $${pIdx++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    return {
      records: listRes.rows.map(mapDailyReportRow),
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Daily Report Compliance & Metrics Summary for a specific date
   */
  async getSummary({ orgId, managerId = null, deptId = '', date = null } = {}) {
    const targetDate = date || new Date().toISOString().split('T')[0];

    const empConditions = ['e.org_id = $1', "e.status = 'Active'", CEO_ADMIN_EXCLUSION_SQL];
    const empValues = [orgId];
    let pIdx = 2;

    if (managerId) {
      empConditions.push(`e.manager_id = $${pIdx++}`);
      empValues.push(managerId);
    }
    if (deptId) {
      empConditions.push(`e.dept_id = $${pIdx++}`);
      empValues.push(deptId);
    }

    // 1. Total eligible active employees in scope
    const totalEmpSql = `SELECT COUNT(*)::int AS count FROM employees e WHERE ${empConditions.join(' AND ')};`;
    const totalEmpRes = await pool.query(totalEmpSql, empValues);
    const totalEmployees = totalEmpRes.rows[0]?.count || 0;

    // 2. Total reports submitted for target date
    const reportConditions = ['r.org_id = $1', 'r.report_date = $2::date', CEO_ADMIN_EXCLUSION_SQL];
    const reportValues = [orgId, targetDate];
    let rIdx = 3;

    if (managerId) {
      reportConditions.push(`e.manager_id = $${rIdx++}`);
      reportValues.push(managerId);
    }
    if (deptId) {
      reportConditions.push(`e.dept_id = $${rIdx++}`);
      reportValues.push(deptId);
    }

    const reportMetricsSql = `
      SELECT
        COUNT(r.id)::int AS "submittedCount",
        COUNT(r.id) FILTER (WHERE r.status = 'ACKNOWLEDGED')::int AS "acknowledgedCount"
      FROM daily_work_reports r
      JOIN employees e ON e.id = r.employee_id
      WHERE ${reportConditions.join(' AND ')};
    `;
    const reportMetricsRes = await pool.query(reportMetricsSql, reportValues);
    const row = reportMetricsRes.rows[0] || {};
    const submittedCount = row.submittedCount || 0;
    const pendingCount = Math.max(0, totalEmployees - submittedCount);
    const complianceRate = totalEmployees > 0 ? parseFloat(((submittedCount / totalEmployees) * 100).toFixed(1)) : 0;

    return {
      date: targetDate,
      totalEmployees,
      submittedCount,
      pendingCount,
      acknowledgedCount: row.acknowledgedCount || 0,
      complianceRate,
    };
  },

  /**
   * Add manager feedback / review acknowledgement
   */
  async addFeedback(id, { managerFeedback, reviewedBy }) {
    const sql = `
      UPDATE daily_work_reports
      SET manager_feedback = $1,
          reviewed_by = $2,
          reviewed_at = NOW(),
          status = 'ACKNOWLEDGED',
          updated_at = NOW()
      WHERE id = $3
      RETURNING id;
    `;
    const res = await pool.query(sql, [managerFeedback, reviewedBy, id]);
    if (res.rows.length === 0) return null;
    return this.findById(id);
  },
};
