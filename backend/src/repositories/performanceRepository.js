import { pool } from '../config/db.js';

/**
 * Maps database row to structured Performance Period object
 */
const mapPeriodRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    name: row.name,
    code: row.code,
    periodType: row.period_type,
    startDate: row.start_date,
    endDate: row.end_date,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

/**
 * Maps database row to structured Performance Goal object
 */
const mapGoalRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    performanceRecordId: row.performance_record_id,
    employeeId: row.employee_id,
    title: row.title,
    description: row.description || '',
    metricTarget: row.metric_target || '',
    metricAchieved: row.metric_achieved || '',
    weightage: parseFloat(row.weightage) || 0,
    rating: row.rating !== null && row.rating !== undefined ? parseFloat(row.rating) : null,
    status: row.status,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

/**
 * Maps database row to structured Performance Record object
 */
const mapRecordRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    recordNumber: row.record_number,
    orgId: row.org_id,
    employeeId: row.employee_id,
    reviewerId: row.reviewer_id || null,
    reviewerUserId: row.reviewer_user_id || null,
    periodId: row.period_id || null,
    reviewPeriod: row.review_period,
    status: row.status,
    approvalState: row.approval_state,
    currentStage: row.current_stage || 'EMPLOYEE_SUBMISSION',
    rating: row.rating !== null && row.rating !== undefined ? parseFloat(row.rating) : null,
    score: row.score !== null && row.score !== undefined ? parseFloat(row.score) : null,
    feedback: row.feedback || '',
    selfComments: row.self_comments || '',
    reviewerComments: row.reviewer_comments || '',
    rejectionReason: row.rejection_reason || '',
    reviewDate: row.review_date || null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    managerReviewedAt: row.manager_reviewed_at ? new Date(row.manager_reviewed_at).toISOString() : null,
    hrReviewedAt: row.hr_reviewed_at ? new Date(row.hr_reviewed_at).toISOString() : null,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    rejectedAt: row.rejected_at ? new Date(row.rejected_at).toISOString() : null,
    hrReviewerId: row.hr_reviewer_id || null,
    hrReviewerUserId: row.hr_reviewer_user_id || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    employee: row.e_id
      ? {
          id: row.e_id,
          employeeCode: row.employee_code,
          fullName: `${row.e_first_name || ''} ${row.e_last_name || ''}`.trim(),
          email: row.e_email,
          department: row.dept_name || '',
          designation: row.desig_title || '',
          userId: row.e_user_id || null,
        }
      : undefined,
    reviewer: row.r_id
      ? {
          id: row.r_id,
          employeeCode: row.r_employee_code,
          fullName: `${row.r_first_name || ''} ${row.r_last_name || ''}`.trim(),
          email: row.r_email,
        }
      : null,
    goals: Array.isArray(row.goals) ? row.goals.map(mapGoalRow) : undefined,
  };
};

export const performanceRepository = {
  // ==========================================
  // 1. PERFORMANCE PERIODS
  // ==========================================

  async createPeriod(data) {
    const query = `
      INSERT INTO performance_periods (
        id, org_id, name, code, period_type, start_date, end_date, due_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *;
    `;
    const values = [
      data.id,
      data.orgId,
      data.name,
      data.code,
      data.periodType || 'ANNUAL',
      data.startDate,
      data.endDate,
      data.dueDate || null,
      data.status || 'ACTIVE',
    ];
    const { rows } = await pool.query(query, values);
    return mapPeriodRow(rows[0]);
  },

  async findPeriods(orgId, filters = {}) {
    const conditions = ['org_id = $1'];
    const values = [orgId];
    let idx = 2;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }

    if (filters.periodType) {
      conditions.push(`period_type = $${idx++}`);
      values.push(filters.periodType);
    }

    const query = `
      SELECT * FROM performance_periods
      WHERE ${conditions.join(' AND ')}
      ORDER BY start_date DESC;
    `;
    const { rows } = await pool.query(query, values);
    return rows.map(mapPeriodRow);
  },

  async findPeriodById(id, orgId) {
    const query = `
      SELECT * FROM performance_periods
      WHERE id = $1 AND org_id = $2;
    `;
    const { rows } = await pool.query(query, [id, orgId]);
    return mapPeriodRow(rows[0]);
  },

  // ==========================================
  // 2. PERFORMANCE RECORDS
  // ==========================================

  async createRecord(data, goals = []) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const recordQuery = `
        INSERT INTO performance_records (
          id, record_number, org_id, employee_id, reviewer_id, reviewer_user_id,
          period_id, review_period, status, approval_state, rating, score,
          feedback, self_comments, reviewer_comments, review_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING *;
      `;
      const recordValues = [
        data.id,
        data.recordNumber,
        data.orgId,
        data.employeeId,
        data.reviewerId || null,
        data.reviewerUserId || null,
        data.periodId || null,
        data.reviewPeriod,
        data.status || 'DRAFT',
        data.approvalState || 'PENDING',
        data.rating || null,
        data.score || null,
        data.feedback || '',
        data.selfComments || '',
        data.reviewerComments || '',
        data.reviewDate || new Date().toISOString().split('T')[0],
      ];
      const { rows } = await client.query(recordQuery, recordValues);
      const insertedRecord = rows[0];

      // Insert line goals if provided
      const insertedGoals = [];
      if (Array.isArray(goals) && goals.length > 0) {
        for (const goal of goals) {
          const goalId = goal.id || `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const goalQuery = `
            INSERT INTO performance_goals (
              id, performance_record_id, employee_id, title, description,
              metric_target, metric_achieved, weightage, rating, status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *;
          `;
          const goalValues = [
            goalId,
            insertedRecord.id,
            data.employeeId,
            goal.title,
            goal.description || '',
            goal.metricTarget || '',
            goal.metricAchieved || '',
            goal.weightage || 0.0,
            goal.rating || null,
            goal.status || 'IN_PROGRESS',
          ];
          const goalRes = await client.query(goalQuery, goalValues);
          insertedGoals.push(goalRes.rows[0]);
        }
      }

      // Record creation in workflow history
      if (data.actorUserId) {
        await client.query(
          `INSERT INTO performance_review_history (
            id, performance_record_id, actor_user_id, action, from_status, to_status, comments
          ) VALUES ($1, $2, $3, 'CREATED', 'DRAFT', $4, $5)`,
          [
            `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            insertedRecord.id,
            data.actorUserId,
            data.status || 'DRAFT',
            'Initial performance record created.',
          ]
        );
      }

      await client.query('COMMIT');
      insertedRecord.goals = insertedGoals;
      return mapRecordRow(insertedRecord);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async findRecords(orgId, filters = {}) {
    const conditions = ['pr.org_id = $1'];
    const values = [orgId];
    let idx = 2;

    if (filters.employeeId) {
      conditions.push(`pr.employee_id = $${idx++}`);
      values.push(filters.employeeId);
    }

    if (filters.reviewerId) {
      conditions.push(`pr.reviewer_id = $${idx++}`);
      values.push(filters.reviewerId);
    }

    if (filters.status) {
      conditions.push(`pr.status = $${idx++}`);
      values.push(filters.status);
    }

    if (filters.reviewPeriod) {
      conditions.push(`pr.review_period = $${idx++}`);
      values.push(filters.reviewPeriod);
    }

    if (filters.periodId) {
      conditions.push(`pr.period_id = $${idx++}`);
      values.push(filters.periodId);
    }

    const query = `
      SELECT 
        pr.*,
        e.id AS e_id, e.employee_code, e.first_name AS e_first_name, e.last_name AS e_last_name, e.email AS e_email, e.user_id AS e_user_id,
        d.name AS dept_name,
        ds.title AS desig_title,
        r.id AS r_id, r.employee_code AS r_employee_code, r.first_name AS r_first_name, r.last_name AS r_last_name, r.email AS r_email
      FROM performance_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY pr.created_at DESC;
    `;
    const { rows } = await pool.query(query, values);
    return rows.map(mapRecordRow);
  },

  async findTeamRecords(orgId, managerEmployeeId) {
    const query = `
      SELECT 
        pr.*,
        e.id AS e_id, e.employee_code, e.first_name AS e_first_name, e.last_name AS e_last_name, e.email AS e_email, e.user_id AS e_user_id,
        d.name AS dept_name,
        ds.title AS desig_title,
        r.id AS r_id, r.employee_code AS r_employee_code, r.first_name AS r_first_name, r.last_name AS r_last_name, r.email AS r_email
      FROM performance_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      WHERE pr.org_id = $1 AND (e.manager_id = $2 OR pr.reviewer_id = $2)
      ORDER BY pr.created_at DESC;
    `;
    const { rows } = await pool.query(query, [orgId, managerEmployeeId]);
    return rows.map(mapRecordRow);
  },

  async findRecordByEmployeeAndPeriod(employeeId, reviewPeriod) {
    const query = `
      SELECT id, record_number, employee_id, review_period, status
      FROM performance_records
      WHERE employee_id = $1 AND review_period = $2;
    `;
    const { rows } = await pool.query(query, [employeeId, reviewPeriod]);
    return rows[0] || null;
  },

  async findRecordById(id, orgId) {
    const recordQuery = `
      SELECT 
        pr.*,
        e.id AS e_id, e.employee_code, e.first_name AS e_first_name, e.last_name AS e_last_name, e.email AS e_email, e.user_id AS e_user_id,
        d.name AS dept_name,
        ds.title AS desig_title,
        r.id AS r_id, r.employee_code AS r_employee_code, r.first_name AS r_first_name, r.last_name AS r_last_name, r.email AS r_email
      FROM performance_records pr
      JOIN employees e ON pr.employee_id = e.id
      LEFT JOIN departments d ON e.dept_id = d.id
      LEFT JOIN designations ds ON e.desig_id = ds.id
      LEFT JOIN employees r ON pr.reviewer_id = r.id
      WHERE pr.id = $1 AND pr.org_id = $2;
    `;
    const { rows } = await pool.query(recordQuery, [id, orgId]);
    if (!rows[0]) return null;

    const record = rows[0];

    // Fetch goals
    const goalsRes = await pool.query(
      `SELECT * FROM performance_goals WHERE performance_record_id = $1 ORDER BY created_at ASC;`,
      [id]
    );
    record.goals = goalsRes.rows;

    return mapRecordRow(record);
  },

  async updateRecord(id, orgId, updates = {}) {
    const fields = [];
    const values = [id, orgId];
    let idx = 3;

    if (updates.rating !== undefined) {
      fields.push(`rating = $${idx++}`);
      values.push(updates.rating);
    }
    if (updates.score !== undefined) {
      fields.push(`score = $${idx++}`);
      values.push(updates.score);
    }
    if (updates.feedback !== undefined) {
      fields.push(`feedback = $${idx++}`);
      values.push(updates.feedback);
    }
    if (updates.selfComments !== undefined) {
      fields.push(`self_comments = $${idx++}`);
      values.push(updates.selfComments);
    }
    if (updates.reviewerComments !== undefined) {
      fields.push(`reviewer_comments = $${idx++}`);
      values.push(updates.reviewerComments);
    }
    if (updates.rejectionReason !== undefined) {
      fields.push(`rejection_reason = $${idx++}`);
      values.push(updates.rejectionReason);
    }
    if (updates.reviewerId !== undefined) {
      fields.push(`reviewer_id = $${idx++}`);
      values.push(updates.reviewerId);
    }
    if (updates.reviewerUserId !== undefined) {
      fields.push(`reviewer_user_id = $${idx++}`);
      values.push(updates.reviewerUserId);
    }

    if (fields.length === 0) return this.findRecordById(id, orgId);

    const query = `
      UPDATE performance_records
      SET ${fields.join(', ')}
      WHERE id = $1 AND org_id = $2
      RETURNING *;
    `;
    await pool.query(query, values);
    return this.findRecordById(id, orgId);
  },

  async updateStatus(id, orgId, newStatus, details = {}) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const curr = await client.query(
        `SELECT status, approval_state FROM performance_records WHERE id = $1 AND org_id = $2;`,
        [id, orgId]
      );
      if (!curr.rows[0]) {
        throw new Error('Performance record not found.');
      }
      const fromStatus = curr.rows[0].status;

      const fields = [`status = $3`];
      const values = [id, orgId, newStatus];
      let idx = 4;

      if (details.approvalState) {
        fields.push(`approval_state = $${idx++}`);
        values.push(details.approvalState);
      } else if (newStatus === 'APPROVED') {
        fields.push(`approval_state = 'APPROVED'`);
      } else if (newStatus === 'REJECTED') {
        fields.push(`approval_state = 'REJECTED'`);
      } else if (newStatus === 'RETURNED') {
        fields.push(`approval_state = 'RETURNED'`);
      } else if (newStatus === 'UNDER_REVIEW') {
        fields.push(`approval_state = 'IN_REVIEW'`);
      }

      if (newStatus === 'SUBMITTED') {
        fields.push(`submitted_at = NOW()`);
        fields.push(`current_stage = 'MANAGER_REVIEW'`);
      } else if (newStatus === 'UNDER_REVIEW') {
        fields.push(`reviewed_at = NOW()`);
        fields.push(`manager_reviewed_at = NOW()`);
        fields.push(`current_stage = 'HR_REVIEW'`);
      } else if (newStatus === 'APPROVED') {
        fields.push(`approved_at = NOW()`);
        fields.push(`hr_reviewed_at = NOW()`);
        fields.push(`current_stage = 'COMPLETED'`);
      } else if (newStatus === 'REJECTED') {
        fields.push(`rejected_at = NOW()`);
        fields.push(`current_stage = 'REJECTED'`);
        if (details.rejectionReason) {
          fields.push(`rejection_reason = $${idx++}`);
          values.push(details.rejectionReason);
        }
      } else if (newStatus === 'RETURNED') {
        fields.push(`current_stage = 'EMPLOYEE_SUBMISSION'`);
        if (details.rejectionReason) {
          fields.push(`rejection_reason = $${idx++}`);
          values.push(details.rejectionReason);
        }
      }

      if (details.feedback) {
        fields.push(`feedback = $${idx++}`);
        values.push(details.feedback);
      }
      if (details.reviewerComments) {
        fields.push(`reviewer_comments = $${idx++}`);
        values.push(details.reviewerComments);
      }
      if (details.rating !== undefined) {
        fields.push(`rating = $${idx++}`);
        values.push(details.rating);
      }
      if (details.score !== undefined) {
        fields.push(`score = $${idx++}`);
        values.push(details.score);
      }

      const updateQuery = `
        UPDATE performance_records
        SET ${fields.join(', ')}
        WHERE id = $1 AND org_id = $2
        RETURNING *;
      `;
      const updateRes = await client.query(updateQuery, values);

      // Add workflow history entry
      if (details.actorUserId) {
        await client.query(
          `INSERT INTO performance_review_history (
            id, performance_record_id, actor_user_id, action, from_status, to_status, comments
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            `act-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            id,
            details.actorUserId,
            newStatus,
            fromStatus,
            newStatus,
            details.comments || details.rejectionReason || '',
          ]
        );
      }

      await client.query('COMMIT');
      return mapRecordRow(updateRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // ==========================================
  // 3. WORKFLOW HISTORY
  // ==========================================

  async getWorkflowHistory(recordId) {
    const query = `
      SELECT 
        prh.*,
        u.first_name, u.last_name, u.email
      FROM performance_review_history prh
      JOIN users u ON prh.actor_user_id = u.id
      WHERE prh.performance_record_id = $1
      ORDER BY prh.created_at ASC;
    `;
    const { rows } = await pool.query(query, [recordId]);
    return rows.map((r) => ({
      id: r.id,
      performanceRecordId: r.performance_record_id,
      actorUserId: r.actor_user_id,
      actorName: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
      actorEmail: r.email,
      action: r.action,
      fromStatus: r.from_status,
      toStatus: r.to_status,
      comments: r.comments || '',
      createdAt: new Date(r.created_at).toISOString(),
    }));
  },

  async updatePeriod(id, orgId, updates = {}) {
    const fields = [];
    const values = [id, orgId];
    let idx = 3;

    if (updates.name) {
      fields.push(`name = $${idx++}`);
      values.push(updates.name);
    }
    if (updates.status) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.dueDate) {
      fields.push(`due_date = $${idx++}`);
      values.push(updates.dueDate);
    }

    if (fields.length === 0) return this.findPeriodById(id, orgId);

    const query = `
      UPDATE performance_periods
      SET ${fields.join(', ')}
      WHERE id = $1 AND org_id = $2
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return mapPeriodRow(rows[0]);
  },

  // ==========================================
  // 4. GOALS CRUD
  // ==========================================

  async addGoal(recordId, employeeId, goalData) {
    const id = goalData.id || `goal-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const query = `
      INSERT INTO performance_goals (
        id, performance_record_id, employee_id, title, description,
        metric_target, metric_achieved, weightage, rating, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *;
    `;
    const values = [
      id,
      recordId,
      employeeId,
      goalData.title,
      goalData.description || '',
      goalData.metricTarget || '',
      goalData.metricAchieved || '',
      goalData.weightage || 0.0,
      goalData.rating || null,
      goalData.status || 'IN_PROGRESS',
    ];
    const { rows } = await pool.query(query, values);
    return mapGoalRow(rows[0]);
  },

  async updateGoal(goalId, updates = {}) {
    const fields = [];
    const values = [goalId];
    let idx = 2;

    if (updates.title) {
      fields.push(`title = $${idx++}`);
      values.push(updates.title);
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.metricTarget !== undefined) {
      fields.push(`metric_target = $${idx++}`);
      values.push(updates.metricTarget);
    }
    if (updates.metricAchieved !== undefined) {
      fields.push(`metric_achieved = $${idx++}`);
      values.push(updates.metricAchieved);
    }
    if (updates.weightage !== undefined) {
      fields.push(`weightage = $${idx++}`);
      values.push(updates.weightage);
    }
    if (updates.rating !== undefined) {
      fields.push(`rating = $${idx++}`);
      values.push(updates.rating);
    }
    if (updates.status) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) {
      const { rows } = await pool.query('SELECT * FROM performance_goals WHERE id = $1;', [goalId]);
      return mapGoalRow(rows[0]);
    }

    const query = `
      UPDATE performance_goals
      SET ${fields.join(', ')}
      WHERE id = $1
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return mapGoalRow(rows[0]);
  },

  async deleteGoal(goalId) {
    const res = await pool.query('DELETE FROM performance_goals WHERE id = $1;', [goalId]);
    return res.rowCount > 0;
  },
};

export default performanceRepository;

