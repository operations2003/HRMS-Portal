import { pool } from '../config/db.js';

const mapExitRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
    employeeEmail: row.email,
    department: row.department_name || '',
    designation: row.designation_title || '',
    managerId: row.manager_id,
    managerName: row.m_first_name ? `${row.m_first_name} ${row.m_last_name || ''}`.trim() : '',
    resignationDate: row.resignation_date ? row.resignation_date.toISOString().split('T')[0] : null,
    noticePeriodDays: row.notice_period_days,
    requestedLastWorkingDay: row.requested_last_working_day ? row.requested_last_working_day.toISOString().split('T')[0] : null,
    approvedLastWorkingDay: row.approved_last_working_day ? row.approved_last_working_day.toISOString().split('T')[0] : null,
    exitType: row.exit_type,
    reason: row.reason,
    comments: row.comments || '',
    status: row.status,
    currentStage: row.current_stage,
    managerFeedback: row.manager_feedback || '',
    managerRating: row.manager_rating ? parseFloat(row.manager_rating) : null,
    managerRehireEligible: row.manager_rehire_eligible,
    managerReviewedAt: row.manager_reviewed_at ? new Date(row.manager_reviewed_at).toISOString() : null,
    hrReviewedAt: row.hr_reviewed_at ? new Date(row.hr_reviewed_at).toISOString() : null,
    hrComments: row.hr_comments || '',
    documentId: row.document_id,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

const mapClearanceRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    exitRequestId: row.exit_request_id,
    employeeId: row.employee_id,
    departmentScope: row.department_scope,
    taskTitle: row.task_title,
    description: row.description || '',
    status: row.status,
    assignedTo: row.assigned_to,
    clearedBy: row.cleared_by,
    clearedByName: row.u_first_name ? `${row.u_first_name} ${row.u_last_name || ''}`.trim() : null,
    clearedAt: row.cleared_at ? new Date(row.cleared_at).toISOString() : null,
    remarks: row.remarks || '',
    recoveryAmount: parseFloat(row.recovery_amount) || 0.0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

const mapFnfRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    exitRequestId: row.exit_request_id,
    employeeId: row.employee_id,
    settlementDate: row.settlement_date ? row.settlement_date.toISOString().split('T')[0] : null,
    payableDays: parseFloat(row.payable_days) || 0,
    salaryPayable: parseFloat(row.salary_payable) || 0,
    leaveEncashmentDays: parseFloat(row.leave_encashment_days) || 0,
    leaveEncashmentAmount: parseFloat(row.leave_encashment_amount) || 0,
    bonusGratuity: parseFloat(row.bonus_gratuity) || 0,
    noticePeriodRecovery: parseFloat(row.notice_period_recovery) || 0,
    assetRecoveryDeduction: parseFloat(row.asset_recovery_deduction) || 0,
    taxDeduction: parseFloat(row.tax_deduction) || 0,
    netSettlementAmount: parseFloat(row.net_settlement_amount) || 0,
    paymentStatus: row.payment_status,
    approvedBy: row.approved_by,
    disbursedAt: row.disbursed_at ? new Date(row.disbursed_at).toISOString() : null,
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

const BASE_EXIT_SELECT = `
  SELECT 
    er.*,
    e.employee_code,
    e.first_name,
    e.last_name,
    e.email,
    e.manager_id,
    e.dept_id,
    d.name AS department_name,
    ds.title AS designation_title,
    m.first_name AS m_first_name,
    m.last_name AS m_last_name
  FROM exit_requests er
  JOIN employees e ON er.employee_id = e.id
  LEFT JOIN departments d ON e.dept_id = d.id
  LEFT JOIN designations ds ON e.desig_id = ds.id
  LEFT JOIN employees m ON e.manager_id = m.id
`;

export const exitRepository = {
  /**
   * 1. Create a new exit request
   */
  async create(data) {
    const id = data.id || `exit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const query = `
      INSERT INTO exit_requests (
        id, org_id, employee_id, resignation_date, notice_period_days,
        requested_last_working_day, approved_last_working_day, exit_type,
        reason, comments, status, current_stage, document_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const params = [
      id,
      data.orgId,
      data.employeeId,
      data.resignationDate || new Date().toISOString().split('T')[0],
      data.noticePeriodDays || 30,
      data.requestedLastWorkingDay,
      data.approvedLastWorkingDay || null,
      data.exitType || 'VOLUNTARY',
      data.reason,
      data.comments || '',
      data.status || 'SUBMITTED',
      data.currentStage || 'MANAGER_REVIEW',
      data.documentId || null,
    ];

    await pool.query(query, params);
    return this.findById(id);
  },

  /**
   * 2. Find exit request by ID
   */
  async findById(id) {
    const query = `${BASE_EXIT_SELECT} WHERE er.id = $1;`;
    const { rows } = await pool.query(query, [id]);
    return mapExitRow(rows[0]);
  },

  /**
   * 3. Find active exit request by employee ID
   */
  async findByEmployeeId(employeeId, orgId) {
    const query = `
      ${BASE_EXIT_SELECT}
      WHERE er.employee_id = $1 AND er.org_id = $2
      ORDER BY er.created_at DESC
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [employeeId, orgId]);
    return mapExitRow(rows[0]);
  },

  /**
   * 4. List exit requests with multi-tenant and manager filtering
   */
  async findAll({ orgId, employeeId = null, managerId = null, status = null, currentStage = null, limit = 50, offset = 0 } = {}) {
    const conditions = ['er.org_id = $1'];
    const params = [orgId];
    let idx = 2;

    if (employeeId) {
      conditions.push(`er.employee_id = $${idx++}`);
      params.push(employeeId);
    }

    if (managerId) {
      conditions.push(`e.manager_id = $${idx++}`);
      params.push(managerId);
    }

    if (status) {
      conditions.push(`er.status = $${idx++}`);
      params.push(status.toUpperCase());
    }

    if (currentStage) {
      conditions.push(`er.current_stage = $${idx++}`);
      params.push(currentStage.toUpperCase());
    }

    const whereClause = conditions.join(' AND ');
    const countQuery = `
      SELECT COUNT(*)::int AS total 
      FROM exit_requests er
      JOIN employees e ON er.employee_id = e.id
      WHERE ${whereClause};
    `;
    const { rows: countRows } = await pool.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataQuery = `
      ${BASE_EXIT_SELECT}
      WHERE ${whereClause}
      ORDER BY er.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);
    return {
      items: rows.map(mapExitRow),
      total,
      limit,
      offset,
    };
  },

  /**
   * 5. Update exit request
   */
  async update(id, updateData) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowedKeys = {
      approvedLastWorkingDay: 'approved_last_working_day',
      noticePeriodDays: 'notice_period_days',
      status: 'status',
      currentStage: 'current_stage',
      managerFeedback: 'manager_feedback',
      managerRating: 'manager_rating',
      managerRehireEligible: 'manager_rehire_eligible',
      managerReviewedAt: 'manager_reviewed_at',
      hrReviewedAt: 'hr_reviewed_at',
      hrComments: 'hr_comments',
      documentId: 'document_id',
    };

    for (const [key, col] of Object.entries(allowedKeys)) {
      if (updateData[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const query = `
      UPDATE exit_requests
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;

    await pool.query(query, values);
    return this.findById(id);
  },

  // =========================================================================
  // CLEARANCE CHECKLIST REPOSITORY METHODS
  // =========================================================================

  /**
   * 6. Create batch clearance tasks
   */
  async createClearanceBatch(tasks) {
    if (!tasks || tasks.length === 0) return [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const created = [];
      for (const t of tasks) {
        const id = t.id || `cl-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        const query = `
          INSERT INTO exit_clearance_checklists (
            id, org_id, exit_request_id, employee_id, department_scope,
            task_title, description, status, assigned_to, recovery_amount
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING *;
        `;
        const res = await client.query(query, [
          id,
          t.orgId,
          t.exitRequestId,
          t.employeeId,
          t.departmentScope,
          t.taskTitle,
          t.description || '',
          t.status || 'PENDING',
          t.assignedTo || null,
          t.recoveryAmount || 0.0,
        ]);
        created.push(res.rows[0]);
      }
      await client.query('COMMIT');
      return created.map(mapClearanceRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * 7. Find all clearance tasks for an exit request
   */
  async findClearancesByRequestId(exitRequestId) {
    const query = `
      SELECT c.*, u.first_name AS u_first_name, u.last_name AS u_last_name
      FROM exit_clearance_checklists c
      LEFT JOIN users u ON c.cleared_by = u.id
      WHERE c.exit_request_id = $1
      ORDER BY c.department_scope ASC, c.created_at ASC;
    `;
    const { rows } = await pool.query(query, [exitRequestId]);
    return rows.map(mapClearanceRow);
  },

  /**
   * 8. Find single clearance task
   */
  async findClearanceTaskById(taskId) {
    const query = `
      SELECT c.*, u.first_name AS u_first_name, u.last_name AS u_last_name
      FROM exit_clearance_checklists c
      LEFT JOIN users u ON c.cleared_by = u.id
      WHERE c.id = $1;
    `;
    const { rows } = await pool.query(query, [taskId]);
    return mapClearanceRow(rows[0]);
  },

  /**
   * 9. Update clearance task status
   */
  async updateClearanceTask(taskId, { status, clearedBy, remarks, recoveryAmount }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
      if (['CLEARED', 'NOT_APPLICABLE', 'REJECTED'].includes(status)) {
        fields.push(`cleared_at = NOW()`);
      }
    }

    if (clearedBy !== undefined) {
      fields.push(`cleared_by = $${idx++}`);
      values.push(clearedBy);
    }

    if (remarks !== undefined) {
      fields.push(`remarks = $${idx++}`);
      values.push(remarks);
    }

    if (recoveryAmount !== undefined) {
      fields.push(`recovery_amount = $${idx++}`);
      values.push(recoveryAmount);
    }

    if (fields.length === 0) return this.findClearanceTaskById(taskId);

    values.push(taskId);
    const query = `
      UPDATE exit_clearance_checklists
      SET ${fields.join(', ')}
      WHERE id = $${idx}
      RETURNING *;
    `;
    await pool.query(query, values);
    return this.findClearanceTaskById(taskId);
  },

  /**
   * 10. Check if all clearances are complete
   */
  async areAllClearancesComplete(exitRequestId) {
    const query = `
      SELECT COUNT(*)::int AS pending_count
      FROM exit_clearance_checklists
      WHERE exit_request_id = $1 AND status = 'PENDING';
    `;
    const { rows } = await pool.query(query, [exitRequestId]);
    return (rows[0]?.pending_count || 0) === 0;
  },

  /**
   * 11. Sum total recovery amounts from clearances
   */
  async getTotalRecoveryAmount(exitRequestId) {
    const query = `
      SELECT COALESCE(SUM(recovery_amount), 0)::float AS total_recovery
      FROM exit_clearance_checklists
      WHERE exit_request_id = $1;
    `;
    const { rows } = await pool.query(query, [exitRequestId]);
    return rows[0]?.total_recovery || 0.0;
  },

  // =========================================================================
  // FULL & FINAL SETTLEMENT REPOSITORY METHODS
  // =========================================================================

  /**
   * 12. Create or update FnF settlement
   */
  async saveFnfSettlement(data) {
    const existing = await this.findFnfByRequestId(data.exitRequestId);
    if (existing) {
      const query = `
        UPDATE fnf_settlements
        SET 
          settlement_date = $1, payable_days = $2, salary_payable = $3,
          leave_encashment_days = $4, leave_encashment_amount = $5,
          bonus_gratuity = $6, notice_period_recovery = $7,
          asset_recovery_deduction = $8, tax_deduction = $9,
          net_settlement_amount = $10, payment_status = $11,
          approved_by = $12, disbursed_at = $13, notes = $14
        WHERE id = $15
        RETURNING *;
      `;
      const params = [
        data.settlementDate || new Date().toISOString().split('T')[0],
        data.payableDays || 0,
        data.salaryPayable || 0,
        data.leaveEncashmentDays || 0,
        data.leaveEncashmentAmount || 0,
        data.bonusGratuity || 0,
        data.noticePeriodRecovery || 0,
        data.assetRecoveryDeduction || 0,
        data.taxDeduction || 0,
        data.netSettlementAmount || 0,
        data.paymentStatus || existing.paymentStatus,
        data.approvedBy || existing.approvedBy,
        data.disbursedAt || existing.disbursedAt,
        data.notes || existing.notes,
        existing.id,
      ];
      const { rows } = await pool.query(query, params);
      return mapFnfRow(rows[0]);
    }

    const id = data.id || `fnf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const query = `
      INSERT INTO fnf_settlements (
        id, org_id, exit_request_id, employee_id, settlement_date,
        payable_days, salary_payable, leave_encashment_days, leave_encashment_amount,
        bonus_gratuity, notice_period_recovery, asset_recovery_deduction,
        tax_deduction, net_settlement_amount, payment_status, approved_by,
        disbursed_at, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *;
    `;
    const params = [
      id,
      data.orgId,
      data.exitRequestId,
      data.employeeId,
      data.settlementDate || new Date().toISOString().split('T')[0],
      data.payableDays || 0,
      data.salaryPayable || 0,
      data.leaveEncashmentDays || 0,
      data.leaveEncashmentAmount || 0,
      data.bonusGratuity || 0,
      data.noticePeriodRecovery || 0,
      data.assetRecoveryDeduction || 0,
      data.taxDeduction || 0,
      data.netSettlementAmount || 0,
      data.paymentStatus || 'DRAFT',
      data.approvedBy || null,
      data.disbursedAt || null,
      data.notes || '',
    ];

    const { rows } = await pool.query(query, params);
    return mapFnfRow(rows[0]);
  },

  /**
   * 13. Find FnF settlement by exit request ID
   */
  async findFnfByRequestId(exitRequestId) {
    const query = `SELECT * FROM fnf_settlements WHERE exit_request_id = $1;`;
    const { rows } = await pool.query(query, [exitRequestId]);
    return mapFnfRow(rows[0]);
  },
};

