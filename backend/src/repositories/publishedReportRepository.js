import { pool } from '../config/db.js';

const mapRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    employeeUserId: row.employee_user_id,
    senderId: row.sender_id,
    senderUserId: row.sender_user_id,
    department: row.department,
    employeeName: row.employee_name,
    employeeCode: row.employee_code,
    designation: row.designation,
    reviewPeriod: row.review_period,
    reviewDate: row.review_date ? row.review_date.toISOString().split('T')[0] : null,
    reviewCycle: row.review_cycle,
    averageScore: row.average_score ? Number(row.average_score) : 0,
    overallRating: row.overall_rating,
    reportData: row.report_data,
    sentCount: row.sent_count || 1,
    status: row.status,
    deletedByUserAt: row.deleted_by_user_at ? new Date(row.deleted_by_user_at).toISOString() : null,
    lastSentAt: row.last_sent_at ? new Date(row.last_sent_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

export const publishedReportRepository = {
  /**
   * Save or re-send a performance report for an employee
   */
  async upsertReport({
    orgId,
    employeeId,
    employeeUserId,
    senderId,
    senderUserId,
    department,
    employeeName,
    employeeCode,
    designation,
    reviewPeriod,
    reviewDate,
    reviewCycle,
    averageScore,
    overallRating,
    reportData,
  }) {
    // Check if an existing report exists for this employee and department
    const existingQuery = `
      SELECT * FROM published_performance_reports
      WHERE org_id = $1 AND employee_id = $2 AND department = $3
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    const existingRes = await pool.query(existingQuery, [orgId, employeeId, department]);

    if (existingRes.rows.length > 0) {
      const existing = existingRes.rows[0];
      const updateQuery = `
        UPDATE published_performance_reports
        SET
          employee_user_id = COALESCE($1, employee_user_id),
          sender_id = $2,
          sender_user_id = $3,
          employee_name = $4,
          employee_code = $5,
          designation = $6,
          review_period = $7,
          review_date = $8,
          review_cycle = $9,
          average_score = $10,
          overall_rating = $11,
          report_data = $12,
          sent_count = sent_count + 1,
          status = 'DELIVERED',
          deleted_by_user_at = NULL,
          last_sent_at = NOW(),
          updated_at = NOW()
        WHERE id = $13
        RETURNING *;
      `;
      const updateValues = [
        employeeUserId,
        senderId,
        senderUserId,
        employeeName,
        employeeCode || '',
        designation || '',
        reviewPeriod || '',
        reviewDate || new Date().toISOString().split('T')[0],
        reviewCycle || 'Quarterly Review',
        averageScore || 0,
        overallRating || 'Meets Expectations',
        JSON.stringify(reportData),
        existing.id,
      ];
      const { rows } = await pool.query(updateQuery, updateValues);
      return mapRow(rows[0]);
    }

    // Insert new published report
    const newId = `prep-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const insertQuery = `
      INSERT INTO published_performance_reports (
        id, org_id, employee_id, employee_user_id, sender_id, sender_user_id,
        department, employee_name, employee_code, designation, review_period,
        review_date, review_cycle, average_score, overall_rating, report_data,
        sent_count, status, deleted_by_user_at, last_sent_at, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        1, 'DELIVERED', NULL, NOW(), NOW(), NOW()
      )
      RETURNING *;
    `;
    const insertValues = [
      newId,
      orgId,
      employeeId,
      employeeUserId,
      senderId,
      senderUserId,
      department,
      employeeName,
      employeeCode || '',
      designation || '',
      reviewPeriod || '',
      reviewDate || new Date().toISOString().split('T')[0],
      reviewCycle || 'Quarterly Review',
      averageScore || 0,
      overallRating || 'Meets Expectations',
      JSON.stringify(reportData),
    ];
    const { rows } = await pool.query(insertQuery, insertValues);
    return mapRow(rows[0]);
  },

  /**
   * Find single report by ID
   */
  async findById(id) {
    const query = `SELECT * FROM published_performance_reports WHERE id = $1 LIMIT 1;`;
    const { rows } = await pool.query(query, [id]);
    return mapRow(rows[0]);
  },

  /**
   * Find active reports delivered to a specific employee or user (status = 'DELIVERED')
   */
  async findActiveForUser({ userId, employeeId, orgId }) {
    const query = `
      SELECT * FROM published_performance_reports
      WHERE org_id = $1
        AND status = 'DELIVERED'
        AND (
          ($2::VARCHAR IS NOT NULL AND employee_user_id = $2)
          OR ($3::VARCHAR IS NOT NULL AND employee_id = $3)
        )
      ORDER BY last_sent_at DESC;
    `;
    const { rows } = await pool.query(query, [orgId, userId || null, employeeId || null]);
    return rows.map(mapRow);
  },

  /**
   * Find report status for a specific employee
   */
  async findByEmployeeAndDept(orgId, employeeId, department) {
    const query = `
      SELECT * FROM published_performance_reports
      WHERE org_id = $1 AND employee_id = $2 AND department = $3
      ORDER BY last_sent_at DESC
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [orgId, employeeId, department]);
    return mapRow(rows[0]);
  },

  /**
   * Mark report as deleted by recipient user
   */
  async markDeletedByUser(reportId, { userId, employeeId }) {
    const query = `
      UPDATE published_performance_reports
      SET
        status = 'DELETED_BY_USER',
        deleted_by_user_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
        AND (
          ($2::VARCHAR IS NOT NULL AND employee_user_id = $2)
          OR ($3::VARCHAR IS NOT NULL AND employee_id = $3)
        )
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [reportId, userId || null, employeeId || null]);
    return mapRow(rows[0]);
  },

  /**
   * List all sent reports for authorized viewers (HR, Admin, Manager)
   */
  async listAllSent({ orgId, department, employeeId }) {
    let query = `
      SELECT ppr.*, 
             e.first_name AS emp_first_name, e.last_name AS emp_last_name, e.email AS emp_email,
             e.employee_code AS emp_code
      FROM published_performance_reports ppr
      LEFT JOIN employees e ON ppr.employee_id = e.id
      WHERE ppr.org_id = $1
    `;
    const params = [orgId];

    if (department && department !== 'all') {
      params.push(department);
      query += ` AND ppr.department = $${params.length}`;
    }

    if (employeeId) {
      params.push(employeeId);
      query += ` AND ppr.employee_id = $${params.length}`;
    }

    query += ` ORDER BY ppr.last_sent_at DESC;`;

    const { rows } = await pool.query(query, params);
    return rows.map((r) => ({
      ...mapRow(r),
      empEmail: r.emp_email,
      empCode: r.emp_code,
    }));
  },
};

export default publishedReportRepository;
