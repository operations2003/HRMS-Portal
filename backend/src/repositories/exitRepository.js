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
    checklistCategory: row.checklist_category || 'GENERAL',
    departmentScope: row.department_scope,
    taskTitle: row.task_title,
    description: row.description || '',
    status: row.status,
    isRequired: row.is_required !== undefined ? row.is_required : true,
    assignedTo: row.assigned_to,
    clearedBy: row.cleared_by,
    clearedByName: row.u_first_name ? `${row.u_first_name} ${row.u_last_name || ''}`.trim() : null,
    clearedAt: row.cleared_at ? new Date(row.cleared_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    remarks: row.remarks || '',
    comments: row.comments || '',
    recoveryAmount: parseFloat(row.recovery_amount) || 0.0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

const mapOffboardingRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    exitRequestId: row.exit_request_id,
    employeeId: row.employee_id,
    lastWorkingDay: row.last_working_day ? row.last_working_day.toISOString().split('T')[0] : null,
    offboardingStatus: row.offboarding_status,
    clearanceStatus: row.clearance_status,
    accessRemovalStatus: row.access_removal_status,
    assetStatus: row.asset_status,
    hrCompletionStatus: row.hr_completion_status,
    completedDate: row.completed_date ? row.completed_date.toISOString().split('T')[0] : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    processedBy: row.processed_by,
    notes: row.notes || '',
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
    lastWorkingDay: row.last_working_day ? row.last_working_day.toISOString().split('T')[0] : null,
    settlementDate: row.settlement_date ? row.settlement_date.toISOString().split('T')[0] : null,
    dailyRate: parseFloat(row.daily_rate) || 0,
    payableDays: parseFloat(row.payable_days) || 0,
    salaryPayable: parseFloat(row.salary_payable) || 0,
    leaveEncashmentDays: parseFloat(row.leave_encashment_days) || 0,
    leaveEncashmentAmount: parseFloat(row.leave_encashment_amount) || 0,
    bonusGratuity: parseFloat(row.bonus_gratuity) || 0,
    otherAllowances: parseFloat(row.other_allowances) || 0,
    reimbursements: parseFloat(row.reimbursements) || 0,
    grossPayable: parseFloat(row.gross_payable) || 0,
    noticePeriodRecovery: parseFloat(row.notice_period_recovery) || 0,
    assetRecoveryDeduction: parseFloat(row.asset_recovery_deduction) || 0,
    taxDeduction: parseFloat(row.tax_deduction) || 0,
    otherDeductions: parseFloat(row.other_deductions) || 0,
    netSettlementAmount: parseFloat(row.net_settlement_amount) || 0,
    paymentStatus: row.payment_status,
    approvalStatus: row.approval_status || 'PENDING',
    approvedBy: row.approved_by,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
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
        reason, comments, status, current_stage, submitted_by, document_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
      data.submittedBy || null,
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
      submittedBy: 'submitted_by',
      reviewedBy: 'reviewed_by',
      approvedBy: 'approved_by',
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
            id, org_id, exit_request_id, employee_id, checklist_category, department_scope,
            task_title, description, status, is_required, assigned_to, recovery_amount
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          RETURNING *;
        `;
        const res = await client.query(query, [
          id,
          t.orgId,
          t.exitRequestId,
          t.employeeId,
          t.checklistCategory || 'GENERAL',
          t.departmentScope,
          t.taskTitle,
          t.description || '',
          t.status || 'PENDING',
          t.isRequired !== undefined ? t.isRequired : true,
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
   * 6b. Create a single custom clearance task
   */
  async createCustomClearanceTask(data) {
    const id = data.id || `cl-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const query = `
      INSERT INTO exit_clearance_checklists (
        id, org_id, exit_request_id, employee_id, checklist_category, department_scope,
        task_title, description, status, is_required, assigned_to, recovery_amount, remarks
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *;
    `;
    const params = [
      id,
      data.orgId,
      data.exitRequestId,
      data.employeeId,
      data.checklistCategory || 'GENERAL',
      data.departmentScope,
      data.taskTitle,
      data.description || '',
      data.status || 'PENDING',
      data.isRequired !== undefined ? data.isRequired : true,
      data.assignedTo || null,
      data.recoveryAmount || 0.0,
      data.remarks || '',
    ];
    const { rows } = await pool.query(query, params);
    return mapClearanceRow(rows[0]);
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
  async updateClearanceTask(taskId, { status, clearedBy, remarks, comments, recoveryAmount }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(status);
      if (['CLEARED', 'COMPLETED', 'NOT_APPLICABLE', 'WAIVED'].includes(status)) {
        fields.push(`cleared_at = NOW()`);
        fields.push(`completed_at = NOW()`);
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

    if (comments !== undefined) {
      fields.push(`comments = $${idx++}`);
      values.push(comments);
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
   * 10. Check if all required clearances are complete
   */
  async areAllClearancesComplete(exitRequestId) {
    const query = `
      SELECT COUNT(*)::int AS pending_count
      FROM exit_clearance_checklists
      WHERE exit_request_id = $1 AND status NOT IN ('CLEARED', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE');
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
  // EMPLOYEE OFFBOARDINGS REPOSITORY METHODS
  // =========================================================================

  /**
   * Find offboarding by exit request ID
   */
  async findOffboardingByRequestId(exitRequestId) {
    const query = `SELECT * FROM employee_offboardings WHERE exit_request_id = $1;`;
    const { rows } = await pool.query(query, [exitRequestId]);
    return mapOffboardingRow(rows[0]);
  },

  /**
   * Upsert offboarding record
   */
  async upsertOffboarding(data) {
    const id = data.id || `offb-${data.exitRequestId}`;
    const query = `
      INSERT INTO employee_offboardings (
        id, org_id, exit_request_id, employee_id, last_working_day,
        offboarding_status, clearance_status, access_removal_status, asset_status,
        hr_completion_status, completed_date, completed_at, processed_by, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (exit_request_id) DO UPDATE SET
        last_working_day = EXCLUDED.last_working_day,
        offboarding_status = EXCLUDED.offboarding_status,
        clearance_status = EXCLUDED.clearance_status,
        access_removal_status = EXCLUDED.access_removal_status,
        asset_status = EXCLUDED.asset_status,
        hr_completion_status = EXCLUDED.hr_completion_status,
        completed_date = EXCLUDED.completed_date,
        completed_at = EXCLUDED.completed_at,
        processed_by = EXCLUDED.processed_by,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *;
    `;
    const params = [
      id,
      data.orgId,
      data.exitRequestId,
      data.employeeId,
      data.lastWorkingDay,
      data.offboardingStatus || 'INITIATED',
      data.clearanceStatus || 'PENDING',
      data.accessRemovalStatus || 'ACTIVE',
      data.assetStatus || 'PENDING',
      data.hrCompletionStatus || 'PENDING',
      data.completedDate || null,
      data.completedAt || null,
      data.processedBy || null,
      data.notes || '',
    ];
    const { rows } = await pool.query(query, params);
    return mapOffboardingRow(rows[0]);
  },

  /**
   * Partial update for offboarding record
   */
  async updateOffboarding(exitRequestId, updateData) {
    const fields = [];
    const values = [];
    let idx = 1;

    const allowed = {
      offboardingStatus: 'offboarding_status',
      clearanceStatus: 'clearance_status',
      accessRemovalStatus: 'access_removal_status',
      assetStatus: 'asset_status',
      hrCompletionStatus: 'hr_completion_status',
      completedDate: 'completed_date',
      completedAt: 'completed_at',
      processedBy: 'processed_by',
      notes: 'notes',
    };

    for (const [key, col] of Object.entries(allowed)) {
      if (updateData[key] !== undefined) {
        fields.push(`${col} = $${idx++}`);
        values.push(updateData[key]);
      }
    }

    if (fields.length === 0) return this.findOffboardingByRequestId(exitRequestId);

    values.push(exitRequestId);
    const query = `
      UPDATE employee_offboardings
      SET ${fields.join(', ')}
      WHERE exit_request_id = $${idx}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return mapOffboardingRow(rows[0]);
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
          settlement_date = $1, last_working_day = $2, daily_rate = $3,
          payable_days = $4, salary_payable = $5,
          leave_encashment_days = $6, leave_encashment_amount = $7,
          bonus_gratuity = $8, other_allowances = $9, reimbursements = $10,
          gross_payable = $11, notice_period_recovery = $12,
          asset_recovery_deduction = $13, tax_deduction = $14, other_deductions = $15,
          net_settlement_amount = $16, payment_status = $17, approval_status = $18,
          approved_by = $19, approved_at = $20, disbursed_at = $21, notes = $22
        WHERE id = $23
        RETURNING *;
      `;
      const params = [
        data.settlementDate || new Date().toISOString().split('T')[0],
        data.lastWorkingDay || existing.lastWorkingDay,
        data.dailyRate !== undefined ? data.dailyRate : existing.dailyRate,
        data.payableDays !== undefined ? data.payableDays : existing.payableDays,
        data.salaryPayable !== undefined ? data.salaryPayable : existing.salaryPayable,
        data.leaveEncashmentDays !== undefined ? data.leaveEncashmentDays : existing.leaveEncashmentDays,
        data.leaveEncashmentAmount !== undefined ? data.leaveEncashmentAmount : existing.leaveEncashmentAmount,
        data.bonusGratuity !== undefined ? data.bonusGratuity : existing.bonusGratuity,
        data.otherAllowances !== undefined ? data.otherAllowances : existing.otherAllowances,
        data.reimbursements !== undefined ? data.reimbursements : existing.reimbursements,
        data.grossPayable !== undefined ? data.grossPayable : existing.grossPayable,
        data.noticePeriodRecovery !== undefined ? data.noticePeriodRecovery : existing.noticePeriodRecovery,
        data.assetRecoveryDeduction !== undefined ? data.assetRecoveryDeduction : existing.assetRecoveryDeduction,
        data.taxDeduction !== undefined ? data.taxDeduction : existing.taxDeduction,
        data.otherDeductions !== undefined ? data.otherDeductions : existing.otherDeductions,
        data.netSettlementAmount !== undefined ? data.netSettlementAmount : existing.netSettlementAmount,
        data.paymentStatus || existing.paymentStatus,
        data.approvalStatus || existing.approvalStatus,
        data.approvedBy || existing.approvedBy,
        data.approvedAt || existing.approvedAt,
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
        id, org_id, exit_request_id, employee_id, settlement_date, last_working_day,
        daily_rate, payable_days, salary_payable, leave_encashment_days, leave_encashment_amount,
        bonus_gratuity, other_allowances, reimbursements, gross_payable, notice_period_recovery,
        asset_recovery_deduction, tax_deduction, other_deductions, net_settlement_amount,
        payment_status, approval_status, approved_by, approved_at, disbursed_at, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *;
    `;
    const params = [
      id,
      data.orgId,
      data.exitRequestId,
      data.employeeId,
      data.settlementDate || new Date().toISOString().split('T')[0],
      data.lastWorkingDay || null,
      data.dailyRate || 0,
      data.payableDays || 0,
      data.salaryPayable || 0,
      data.leaveEncashmentDays || 0,
      data.leaveEncashmentAmount || 0,
      data.bonusGratuity || 0,
      data.otherAllowances || 0,
      data.reimbursements || 0,
      data.grossPayable || 0,
      data.noticePeriodRecovery || 0,
      data.assetRecoveryDeduction || 0,
      data.taxDeduction || 0,
      data.otherDeductions || 0,
      data.netSettlementAmount || 0,
      data.paymentStatus || 'DRAFT',
      data.approvalStatus || 'PENDING',
      data.approvedBy || null,
      data.approvedAt || null,
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

  /**
   * 14. Update FnF settlement status (Approval / Disbursement)
   */
  async updateFnfStatus(exitRequestId, { approvalStatus, paymentStatus, approvedBy, disbursedAt, notes }) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (approvalStatus !== undefined) {
      fields.push(`approval_status = $${idx++}`);
      values.push(approvalStatus);
      if (approvalStatus === 'APPROVED') {
        fields.push(`approved_at = NOW()`);
      }
    }

    if (paymentStatus !== undefined) {
      fields.push(`payment_status = $${idx++}`);
      values.push(paymentStatus);
    }

    if (approvedBy !== undefined) {
      fields.push(`approved_by = $${idx++}`);
      values.push(approvedBy);
    }

    if (disbursedAt !== undefined) {
      fields.push(`disbursed_at = $${idx++}`);
      values.push(disbursedAt);
    }

    if (notes !== undefined) {
      fields.push(`notes = $${idx++}`);
      values.push(notes);
    }

    if (fields.length === 0) return this.findFnfByRequestId(exitRequestId);

    values.push(exitRequestId);
    const query = `
      UPDATE fnf_settlements
      SET ${fields.join(', ')}
      WHERE exit_request_id = $${idx}
      RETURNING *;
    `;
    const { rows } = await pool.query(query, values);
    return mapFnfRow(rows[0]);
  },

  // =========================================================================
  // ACCESS DEPROVISIONING & AUDIT REPOSITORY METHODS
  // =========================================================================

  /**
   * 15. Reassign direct reports when a manager is exited
   */
  async reassignDirectReports(orgId, managerEmployeeId, interimManagerId = null) {
    const query = `
      UPDATE employees
      SET manager_id = $1
      WHERE manager_id = $2 AND org_id = $3
      RETURNING id, employee_code, first_name, last_name;
    `;
    const { rows } = await pool.query(query, [interimManagerId, managerEmployeeId, orgId]);

    // Reassign pending approval workflows assigned to this exiting manager
    await pool.query(
      `UPDATE approval_workflows
       SET manager_id = $1, updated_at = NOW()
       WHERE manager_id = $2 AND org_id = $3 AND current_status IN ('SUBMITTED', 'PENDING', 'UNDER_REVIEW');`,
      [interimManagerId, managerEmployeeId, orgId]
    );

    return rows;
  },

  /**
   * 16. Record an access deprovisioning audit entry
   */
  async recordDeprovisionAudit(data) {
    const id = data.id || `aud-deprov-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const query = `
      INSERT INTO access_deprovisioning_audits (
        id, org_id, exit_request_id, employee_id, user_id, actor_user_id,
        actor_role, action, previous_user_status, new_user_status,
        previous_employee_status, new_employee_status, reassigned_manager_id, reason
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `;
    const params = [
      id,
      data.orgId,
      data.exitRequestId,
      data.employeeId,
      data.userId,
      data.actorUserId,
      data.actorRole,
      data.action || 'DEPROVISION_ACCESS',
      data.previousUserStatus || 'Active',
      data.newUserStatus || 'Inactive',
      data.previousEmployeeStatus || 'Notice Period',
      data.newEmployeeStatus || 'Exited',
      data.reassignedManagerId || null,
      data.reason || 'System access deprovisioned.',
    ];
    const { rows } = await pool.query(query, params);
    return rows[0];
  },

  /**
   * 17. Find deprovisioning audit logs for an exit request
   */
  async findDeprovisionAudits(exitRequestId) {
    const query = `
      SELECT a.*, u.first_name AS actor_first_name, u.last_name AS actor_last_name
      FROM access_deprovisioning_audits a
      LEFT JOIN users u ON a.actor_user_id = u.id
      WHERE a.exit_request_id = $1
      ORDER BY a.created_at DESC;
    `;
    const { rows } = await pool.query(query, [exitRequestId]);
    return rows;
  },

  // =========================================================================
  // ADMIN ANALYTICS & OVERVIEW METRICS
  // =========================================================================

  /**
   * 18. Aggregate admin stats for exit and offboarding module
   */
  async getExitStats(orgId) {
    const [countsRes, exitTypeRes, stageRes, clearanceRes, fnfRes] = await Promise.all([
      pool.query(
        `SELECT 
          COUNT(*)::int AS total_exits,
          COUNT(*) FILTER (WHERE status = 'SUBMITTED')::int AS pending_submission,
          COUNT(*) FILTER (WHERE status = 'UNDER_REVIEW')::int AS under_manager_review,
          COUNT(*) FILTER (WHERE status = 'APPROVED')::int AS approved_notice_period,
          COUNT(*) FILTER (WHERE status = 'COMPLETED')::int AS completed_exits,
          COUNT(*) FILTER (WHERE status = 'REJECTED')::int AS rejected_exits,
          COUNT(*) FILTER (WHERE status = 'WITHDRAWN')::int AS withdrawn_exits
        FROM exit_requests
        WHERE org_id = $1;`,
        [orgId]
      ),
      pool.query(
        `SELECT exit_type, COUNT(*)::int AS count
        FROM exit_requests
        WHERE org_id = $1
        GROUP BY exit_type;`,
        [orgId]
      ),
      pool.query(
        `SELECT current_stage, COUNT(*)::int AS count
        FROM exit_requests
        WHERE org_id = $1
        GROUP BY current_stage;`,
        [orgId]
      ),
      pool.query(
        `SELECT 
          department_scope,
          COUNT(*)::int AS total_tasks,
          COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_tasks,
          COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::int AS in_progress_tasks,
          COUNT(*) FILTER (WHERE status IN ('CLEARED', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE'))::int AS completed_tasks
        FROM exit_clearance_checklists
        WHERE org_id = $1
        GROUP BY department_scope;`,
        [orgId]
      ),
      pool.query(
        `SELECT 
          COUNT(*)::int AS total_fnf_records,
          COALESCE(SUM(net_settlement_amount), 0)::float AS total_settlement_amount,
          COUNT(*) FILTER (WHERE approval_status = 'PENDING')::int AS pending_approvals,
          COUNT(*) FILTER (WHERE payment_status = 'DISBURSED')::int AS disbursed_count
        FROM fnf_settlements
        WHERE org_id = $1;`,
        [orgId]
      ),
    ]);

    return {
      statusCounts: countsRes.rows[0] || {},
      byExitType: exitTypeRes.rows,
      byStage: stageRes.rows,
      departmentalClearances: clearanceRes.rows,
      fnfOverview: fnfRes.rows[0] || {},
    };
  },
};
