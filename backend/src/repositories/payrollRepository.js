import { pool } from '../config/db.js';

/**
 * Format database payroll record row into API object
 */
const mapRecordRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    periodId: row.period_id,
    currency: row.currency || 'INR',
    baseSalary: parseFloat(row.base_salary) || 0,
    grossEarnings: parseFloat(row.gross_earnings) || 0,
    totalDeductions: parseFloat(row.total_deductions) || 0,
    netPayable: parseFloat(row.net_payable) || 0,
    workingDays: parseFloat(row.working_days) || 0,
    paidDays: parseFloat(row.paid_days) || 0,
    lossOfPayDays: parseFloat(row.loss_of_pay_days) || 0,
    status: row.status,
    paymentMethod: row.payment_method,
    paymentReference: row.payment_reference || '',
    paidAt: row.paid_at ? new Date(row.paid_at).toISOString() : null,
    notes: row.notes || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    employee: row.e_id
      ? {
          id: row.e_id,
          employeeCode: row.employee_code,
          firstName: row.first_name,
          lastName: row.last_name,
          fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          email: row.email,
          department: row.dept_name || '',
          designation: row.desig_title || '',
        }
      : undefined,
    period: row.pp_id
      ? {
          id: row.pp_id,
          periodName: row.period_name,
          periodCode: row.period_code,
          startDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
          endDate: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : '',
          paymentDate: row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : '',
          status: row.period_status,
        }
      : undefined,
  };
};

/**
 * Format period row
 */
const mapPeriodRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.org_id,
    periodName: row.period_name,
    periodCode: row.period_code,
    startDate: row.start_date ? new Date(row.start_date).toISOString().split('T')[0] : '',
    endDate: row.end_date ? new Date(row.end_date).toISOString().split('T')[0] : '',
    paymentDate: row.payment_date ? new Date(row.payment_date).toISOString().split('T')[0] : '',
    status: row.status,
    totalEmployees: parseInt(row.total_employees, 10) || 0,
    totalGrossAmount: parseFloat(row.total_gross_amount) || 0,
    totalNetAmount: parseFloat(row.total_net_amount) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

export const payrollRepository = {
  // ==========================================
  // 1. PERIODS
  // ==========================================

  async findPeriods(orgId, filters = {}) {
    let sql = `
      SELECT 
        p.id, p.org_id, p.period_name, p.period_code, p.start_date, p.end_date, 
        p.payment_date, p.status, p.total_employees, p.total_gross_amount, p.total_net_amount,
        p.created_at, p.updated_at
      FROM payroll_periods p
      WHERE p.org_id = $1
    `;
    const params = [orgId];

    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND p.status = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (p.period_name ILIKE $${params.length} OR p.period_code ILIKE $${params.length})`;
    }

    sql += ' ORDER BY p.start_date DESC';

    if (filters.limit) {
      params.push(parseInt(filters.limit, 10));
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(parseInt(filters.offset, 10));
      sql += ` OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows.map(mapPeriodRow);
  },

  async findPeriodById(id, orgId) {
    const sql = `
      SELECT * FROM payroll_periods 
      WHERE id = $1 AND org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(sql, [id, orgId]);
    return mapPeriodRow(res.rows[0]);
  },

  async findPeriodByCode(periodCode, orgId) {
    const sql = `
      SELECT * FROM payroll_periods 
      WHERE LOWER(period_code) = LOWER($1) AND org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(sql, [periodCode, orgId]);
    return mapPeriodRow(res.rows[0]);
  },

  async createPeriod({ orgId, periodName, periodCode, startDate, endDate, paymentDate, status = 'DRAFT' }) {
    const id = `pp-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO payroll_periods (
        id, org_id, period_name, period_code, start_date, end_date, payment_date, 
        status, total_employees, total_gross_amount, total_net_amount, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, 0.00, 0.00, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id, orgId, periodName.trim(), periodCode.trim().toUpperCase(),
      startDate, endDate, paymentDate, status,
    ]);
    return mapPeriodRow(res.rows[0]);
  },

  async updatePeriod(id, orgId, updates) {
    const fields = [];
    const values = [id, orgId];

    if (updates.periodName !== undefined) {
      values.push(updates.periodName.trim());
      fields.push(`period_name = $${values.length}`);
    }
    if (updates.paymentDate !== undefined) {
      values.push(updates.paymentDate);
      fields.push(`payment_date = $${values.length}`);
    }
    if (updates.status !== undefined) {
      values.push(updates.status.toUpperCase());
      fields.push(`status = $${values.length}`);
    }

    if (fields.length === 0) return this.findPeriodById(id, orgId);

    fields.push('updated_at = NOW()');
    const sql = `
      UPDATE payroll_periods
      SET ${fields.join(', ')}
      WHERE id = $1 AND org_id = $2
      RETURNING *;
    `;
    const res = await pool.query(sql, values);
    return mapPeriodRow(res.rows[0]);
  },

  async recalculatePeriodTotals(periodId, orgId, client = pool) {
    const sql = `
      UPDATE payroll_periods
      SET 
        total_employees = sub.emp_count,
        total_gross_amount = sub.total_gross,
        total_net_amount = sub.total_net,
        updated_at = NOW()
      FROM (
        SELECT 
          COUNT(*)::int AS emp_count,
          COALESCE(SUM(gross_earnings), 0.00) AS total_gross,
          COALESCE(SUM(net_payable), 0.00) AS total_net
        FROM payroll_records
        WHERE period_id = $1 AND org_id = $2
      ) sub
      WHERE id = $1 AND org_id = $2
      RETURNING *;
    `;
    const res = await client.query(sql, [periodId, orgId]);
    return mapPeriodRow(res.rows[0]);
  },

  // ==========================================
  // 2. PAYROLL PROFILES
  // ==========================================

  async findProfileByEmployeeId(employeeId, orgId) {
    const sql = `
      SELECT 
        pp.id, pp.org_id, pp.employee_id, pp.currency, pp.base_salary, pp.payment_method,
        pp.bank_name, pp.bank_account_number, pp.bank_ifsc_routing, pp.tax_id,
        pp.effective_from, pp.status, pp.created_at, pp.updated_at,
        e.employee_code, e.first_name, e.last_name, e.email
      FROM payroll_profiles pp
      JOIN employees e ON e.id = pp.employee_id
      WHERE pp.employee_id = $1 AND pp.org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(sql, [employeeId, orgId]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.id,
      orgId: row.org_id,
      employeeId: row.employee_id,
      currency: row.currency,
      baseSalary: parseFloat(row.base_salary) || 0,
      paymentMethod: row.payment_method,
      bankName: row.bank_name || '',
      bankAccountNumber: row.bank_account_number || '',
      bankIfscRouting: row.bank_ifsc_routing || '',
      taxId: row.tax_id || '',
      effectiveFrom: row.effective_from ? new Date(row.effective_from).toISOString().split('T')[0] : '',
      status: row.status,
      employee: {
        id: row.employee_id,
        employeeCode: row.employee_code,
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        email: row.email,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  async upsertProfile({ orgId, employeeId, currency = 'INR', baseSalary = 0, paymentMethod = 'BANK_TRANSFER', bankName = '', bankAccountNumber = '', bankIfscRouting = '', taxId = '', effectiveFrom, status = 'Active' }) {
    const id = `pp-${employeeId}`;
    const sql = `
      INSERT INTO payroll_profiles (
        id, org_id, employee_id, currency, base_salary, payment_method,
        bank_name, bank_account_number, bank_ifsc_routing, tax_id,
        effective_from, status, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, CURRENT_DATE), $12, NOW(), NOW())
      ON CONFLICT (employee_id) DO UPDATE
      SET 
        currency = EXCLUDED.currency,
        base_salary = EXCLUDED.base_salary,
        payment_method = EXCLUDED.payment_method,
        bank_name = EXCLUDED.bank_name,
        bank_account_number = EXCLUDED.bank_account_number,
        bank_ifsc_routing = EXCLUDED.bank_ifsc_routing,
        tax_id = EXCLUDED.tax_id,
        effective_from = EXCLUDED.effective_from,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id, orgId, employeeId, currency, baseSalary, paymentMethod,
      bankName, bankAccountNumber, bankIfscRouting, taxId, effectiveFrom || null, status
    ]);
    return res.rows[0];
  },

  // ==========================================
  // 3. PAYROLL RECORDS
  // ==========================================

  async findRecords(orgId, filters = {}) {
    let sql = `
      SELECT 
        pr.*,
        e.id AS e_id, e.employee_code, e.first_name, e.last_name, e.email,
        d.name AS dept_name,
        ds.title AS desig_title,
        pp.id AS pp_id, pp.period_name, pp.period_code, pp.start_date, pp.end_date, pp.payment_date, pp.status AS period_status
      FROM payroll_records pr
      JOIN employees e ON e.id = pr.employee_id
      LEFT JOIN departments d ON d.id = e.dept_id
      LEFT JOIN designations ds ON ds.id = e.desig_id
      JOIN payroll_periods pp ON pp.id = pr.period_id
      WHERE pr.org_id = $1
    `;
    const params = [orgId];

    if (filters.periodId) {
      params.push(filters.periodId);
      sql += ` AND pr.period_id = $${params.length}`;
    }

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND pr.employee_id = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND pr.status = $${params.length}`;
    }

    if (filters.departmentId) {
      params.push(filters.departmentId);
      sql += ` AND e.dept_id = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length} OR e.employee_code ILIKE $${params.length})`;
    }

    sql += ' ORDER BY pr.created_at DESC';

    if (filters.limit) {
      params.push(parseInt(filters.limit, 10));
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(parseInt(filters.offset, 10));
      sql += ` OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows.map(mapRecordRow);
  },

  async findRecordById(id, orgId) {
    const recordSql = `
      SELECT 
        pr.*,
        e.id AS e_id, e.employee_code, e.first_name, e.last_name, e.email,
        d.name AS dept_name,
        ds.title AS desig_title,
        pp.id AS pp_id, pp.period_name, pp.period_code, pp.start_date, pp.end_date, pp.payment_date, pp.status AS period_status
      FROM payroll_records pr
      JOIN employees e ON e.id = pr.employee_id
      LEFT JOIN departments d ON d.id = e.dept_id
      LEFT JOIN designations ds ON ds.id = e.desig_id
      JOIN payroll_periods pp ON pp.id = pr.period_id
      WHERE pr.id = $1 AND pr.org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(recordSql, [id, orgId]);
    if (res.rows.length === 0) return null;

    const record = mapRecordRow(res.rows[0]);

    // Fetch items
    const itemsSql = `
      SELECT id, item_type, category, name, amount
      FROM payroll_items
      WHERE payroll_record_id = $1
      ORDER BY item_type ASC, name ASC;
    `;
    const itemsRes = await pool.query(itemsSql, [id]);
    record.items = itemsRes.rows.map((item) => ({
      id: item.id,
      itemType: item.item_type,
      category: item.category,
      name: item.name,
      amount: parseFloat(item.amount) || 0,
    }));

    return record;
  },

  async findRecordByEmployeeAndPeriod(employeeId, periodId, orgId) {
    const sql = `
      SELECT id FROM payroll_records
      WHERE employee_id = $1 AND period_id = $2 AND org_id = $3
      LIMIT 1;
    `;
    const res = await pool.query(sql, [employeeId, periodId, orgId]);
    return res.rows[0] || null;
  },

  /**
   * Create payroll record with breakdown items transactionally
   */
  async createRecordWithItems(data, items = []) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const recordId = `prec-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const insertRecordSql = `
        INSERT INTO payroll_records (
          id, org_id, employee_id, period_id, currency, base_salary,
          gross_earnings, total_deductions, net_payable, working_days,
          paid_days, loss_of_pay_days, status, payment_method, notes,
          created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9::numeric,
          $10::numeric, $11::numeric, $12::numeric, $13, $14, $15, NOW(), NOW()
        )
        RETURNING *;
      `;

      const recordRes = await client.query(insertRecordSql, [
        recordId,
        data.orgId,
        data.employeeId,
        data.periodId,
        data.currency || 'INR',
        data.baseSalary,
        data.grossEarnings,
        data.totalDeductions,
        data.netPayable,
        data.workingDays || 30,
        data.paidDays || 30,
        data.lossOfPayDays || 0,
        data.status || 'DRAFT',
        data.paymentMethod || 'BANK_TRANSFER',
        data.notes || '',
      ]);

      // Insert item breakdown
      for (const item of items) {
        const itemId = `pitem-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const insertItemSql = `
          INSERT INTO payroll_items (
            id, payroll_record_id, item_type, category, name, amount, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::numeric, NOW(), NOW());
        `;
        await client.query(insertItemSql, [
          itemId,
          recordId,
          item.itemType.toUpperCase(),
          item.category || item.name.toUpperCase().replace(/\s+/g, '_'),
          item.name.trim(),
          item.amount,
        ]);
      }

      // Recalculate Period Aggregate Totals
      await this.recalculatePeriodTotals(data.periodId, data.orgId, client);

      await client.query('COMMIT');
      return mapRecordRow(recordRes.rows[0]);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Update existing payroll record transactionally
   */
  async updateRecordWithItems(id, orgId, data, items = null) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateSql = `
        UPDATE payroll_records
        SET 
          base_salary = COALESCE($1::numeric, base_salary),
          gross_earnings = COALESCE($2::numeric, gross_earnings),
          total_deductions = COALESCE($3::numeric, total_deductions),
          net_payable = COALESCE($4::numeric, net_payable),
          working_days = COALESCE($5::numeric, working_days),
          paid_days = COALESCE($6::numeric, paid_days),
          loss_of_pay_days = COALESCE($7::numeric, loss_of_pay_days),
          payment_method = COALESCE($8, payment_method),
          notes = COALESCE($9, notes),
          updated_at = NOW()
        WHERE id = $10 AND org_id = $11
        RETURNING *;
      `;

      const res = await client.query(updateSql, [
        data.baseSalary !== undefined ? data.baseSalary : null,
        data.grossEarnings !== undefined ? data.grossEarnings : null,
        data.totalDeductions !== undefined ? data.totalDeductions : null,
        data.netPayable !== undefined ? data.netPayable : null,
        data.workingDays !== undefined ? data.workingDays : null,
        data.paidDays !== undefined ? data.paidDays : null,
        data.lossOfPayDays !== undefined ? data.lossOfPayDays : null,
        data.paymentMethod || null,
        data.notes !== undefined ? data.notes : null,
        id,
        orgId,
      ]);

      if (res.rows.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      const updatedRow = res.rows[0];

      // Update items if provided
      if (Array.isArray(items)) {
        await client.query('DELETE FROM payroll_items WHERE payroll_record_id = $1', [id]);
        for (const item of items) {
          const itemId = `pitem-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          const insertItemSql = `
            INSERT INTO payroll_items (
              id, payroll_record_id, item_type, category, name, amount, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::numeric, NOW(), NOW());
          `;
          await client.query(insertItemSql, [
            itemId,
            id,
            item.itemType.toUpperCase(),
            item.category || item.name.toUpperCase().replace(/\s+/g, '_'),
            item.name.trim(),
            item.amount,
          ]);
        }
      }

      // Recalculate Period Aggregate Totals
      await this.recalculatePeriodTotals(updatedRow.period_id, orgId, client);

      await client.query('COMMIT');
      return mapRecordRow(updatedRow);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async updateRecordStatus(id, orgId, status, details = {}) {
    const fields = ['status = $1', 'updated_at = NOW()'];
    const values = [status.toUpperCase(), id, orgId];

    if (details.paymentReference) {
      values.push(details.paymentReference.trim());
      fields.push(`payment_reference = $${values.length}`);
    }

    if (status.toUpperCase() === 'PAID') {
      fields.push('paid_at = NOW()');
    }

    const sql = `
      UPDATE payroll_records
      SET ${fields.join(', ')}
      WHERE id = $2 AND org_id = $3
      RETURNING *;
    `;
    const res = await pool.query(sql, values);
    return mapRecordRow(res.rows[0]);
  },

  // ==========================================
  // 4. EMPLOYEE OWN ACCESS (IDOR PROTECTION)
  // ==========================================

  async findEmployeeOwnRecords(employeeId, orgId, filters = {}) {
    return this.findRecords(orgId, { ...filters, employeeId });
  },

  async findEmployeeOwnRecordById(recordId, employeeId, orgId) {
    const record = await this.findRecordById(recordId, orgId);
    if (!record || record.employeeId !== employeeId) {
      return null;
    }
    return record;
  },

  // ==========================================
  // 5. SUMMARIES & METRICS
  // ==========================================

  async getOrganizationPayrollSummary(orgId) {
    const metricsSql = `
      SELECT 
        COUNT(DISTINCT pr.employee_id)::int AS "employeesOnPayroll",
        COALESCE(SUM(CASE WHEN pr.status = 'PAID' THEN pr.net_payable ELSE 0 END), 0.00)::float AS "totalPaidYtd",
        COALESCE(SUM(CASE WHEN pr.status IN ('DRAFT', 'PROCESSING', 'PROCESSED') THEN pr.net_payable ELSE 0 END), 0.00)::float AS "pendingPayoutAmount",
        COALESCE(AVG(pr.net_payable), 0.00)::float AS "averageNetSalary"
      FROM payroll_records pr
      WHERE pr.org_id = $1;
    `;

    const latestPeriodSql = `
      SELECT id, period_name, period_code, status, total_employees, total_net_amount
      FROM payroll_periods
      WHERE org_id = $1
      ORDER BY start_date DESC
      LIMIT 1;
    `;

    const statusCountsSql = `
      SELECT status, COUNT(*)::int AS count, COALESCE(SUM(net_payable), 0.00)::float AS total
      FROM payroll_records
      WHERE org_id = $1
      GROUP BY status;
    `;

    const [metricsRes, latestPeriodRes, statusCountsRes] = await Promise.all([
      pool.query(metricsSql, [orgId]),
      pool.query(latestPeriodSql, [orgId]),
      pool.query(statusCountsSql, [orgId]),
    ]);

    const statusBreakdown = {
      DRAFT: { count: 0, amount: 0 },
      PROCESSING: { count: 0, amount: 0 },
      PROCESSED: { count: 0, amount: 0 },
      PAID: { count: 0, amount: 0 },
      CANCELLED: { count: 0, amount: 0 },
    };

    statusCountsRes.rows.forEach((row) => {
      if (statusBreakdown[row.status]) {
        statusBreakdown[row.status] = {
          count: row.count,
          amount: row.total,
        };
      }
    });

    return {
      metrics: metricsRes.rows[0] || {
        employeesOnPayroll: 0,
        totalPaidYtd: 0,
        pendingPayoutAmount: 0,
        averageNetSalary: 0,
      },
      latestPeriod: latestPeriodRes.rows[0] ? mapPeriodRow(latestPeriodRes.rows[0]) : null,
      statusBreakdown,
    };
  },

  async getPeriodSummary(periodId, orgId) {
    const period = await this.findPeriodById(periodId, orgId);
    if (!period) return null;

    const summarySql = `
      SELECT 
        COUNT(*)::int AS "recordCount",
        COALESCE(SUM(gross_earnings), 0.00)::float AS "grossAmount",
        COALESCE(SUM(total_deductions), 0.00)::float AS "deductionsAmount",
        COALESCE(SUM(net_payable), 0.00)::float AS "netAmount",
        COUNT(CASE WHEN status = 'PAID' THEN 1 END)::int AS "paidCount",
        COUNT(CASE WHEN status != 'PAID' THEN 1 END)::int AS "pendingCount"
      FROM payroll_records
      WHERE period_id = $1 AND org_id = $2;
    `;

    const methodSql = `
      SELECT payment_method, COUNT(*)::int AS count, COALESCE(SUM(net_payable), 0.00)::float AS total
      FROM payroll_records
      WHERE period_id = $1 AND org_id = $2
      GROUP BY payment_method;
    `;

    const itemCategorySql = `
      SELECT pi.item_type, pi.category, COUNT(*)::int AS count, COALESCE(SUM(pi.amount), 0.00)::float AS total
      FROM payroll_items pi
      JOIN payroll_records pr ON pr.id = pi.payroll_record_id
      WHERE pr.period_id = $1 AND pr.org_id = $2
      GROUP BY pi.item_type, pi.category
      ORDER BY pi.item_type, total DESC;
    `;

    const [summaryRes, methodRes, itemCatRes] = await Promise.all([
      pool.query(summarySql, [periodId, orgId]),
      pool.query(methodSql, [periodId, orgId]),
      pool.query(itemCategorySql, [periodId, orgId]),
    ]);

    return {
      period,
      financials: summaryRes.rows[0],
      paymentMethods: methodRes.rows,
      itemCategories: itemCatRes.rows,
    };
  },

  // ==========================================
  // 6. PAYSLIPS
  // ==========================================

  async findPayslips(orgId, filters = {}) {
    let sql = 'SELECT * FROM v_employee_payslips WHERE org_id = $1';
    const params = [orgId];

    if (filters.periodId) {
      params.push(filters.periodId);
      sql += ` AND period_id = $${params.length}`;
    }

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND employee_id = $${params.length}`;
    }

    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND payslip_status = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (employee_name ILIKE $${params.length} OR employee_code ILIKE $${params.length} OR payslip_number ILIKE $${params.length})`;
    }

    sql += ' ORDER BY issue_date DESC, created_at DESC';

    if (filters.limit) {
      params.push(parseInt(filters.limit, 10));
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(parseInt(filters.offset, 10));
      sql += ` OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows;
  },

  async findPayslipsByEmployeeId(employeeId, orgId, filters = {}) {
    let sql = 'SELECT * FROM v_employee_payslips WHERE employee_id = $1 AND org_id = $2';
    const params = [employeeId, orgId];

    if (filters.periodId) {
      params.push(filters.periodId);
      sql += ` AND period_id = $${params.length}`;
    }

    sql += ' ORDER BY issue_date DESC, created_at DESC';

    if (filters.limit) {
      params.push(parseInt(filters.limit, 10));
      sql += ` LIMIT $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows;
  },

  async findPayslipById(id, orgId, employeeId = null) {
    let sql = 'SELECT * FROM v_employee_payslips WHERE (payslip_id = $1 OR payslip_number = $1) AND org_id = $2';
    const params = [id, orgId];

    if (employeeId) {
      params.push(employeeId);
      sql += ` AND employee_id = $${params.length}`;
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, params);
    if (res.rows.length === 0) return null;

    const payslip = res.rows[0];

    // Fetch itemized breakdown
    const itemsSql = `
      SELECT * FROM v_payslip_items
      WHERE payroll_record_id = $1
      ORDER BY item_type ASC, amount DESC;
    `;
    const itemsRes = await pool.query(itemsSql, [payslip.payroll_record_id]);
    payslip.items = itemsRes.rows;

    return payslip;
  },

  async incrementPayslipDownload(id, orgId) {
    const sql = `
      UPDATE payslips
      SET download_count = download_count + 1, updated_at = NOW()
      WHERE (id = $1 OR payslip_number = $1) AND org_id = $2
      RETURNING id, download_count;
    `;
    const res = await pool.query(sql, [id, orgId]);
    return res.rows[0] || null;
  },

  async generatePayslipsForPeriod(periodId, orgId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Find all paid records in this period that do not yet have a payslip
      const missingSql = `
        SELECT pr.id AS record_id, pr.employee_id, pr.created_at
        FROM payroll_records pr
        LEFT JOIN payslips ps ON ps.payroll_record_id = pr.id
        WHERE pr.period_id = $1 AND pr.org_id = $2 AND pr.status = 'PAID' AND ps.id IS NULL;
      `;
      const missingRes = await client.query(missingSql, [periodId, orgId]);

      const createdPayslips = [];

      for (const rec of missingRes.rows) {
        const payslipId = `ps-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const payslipNumber = `PS-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

        const insertSql = `
          INSERT INTO payslips (
            id, org_id, employee_id, period_id, payroll_record_id, payslip_number,
            status, issue_date, download_count, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'PUBLISHED', CURRENT_DATE, 0, NOW(), NOW())
          RETURNING *;
        `;
        const res = await client.query(insertSql, [
          payslipId, orgId, rec.employee_id, periodId, rec.record_id, payslipNumber
        ]);
        createdPayslips.push(res.rows[0]);
      }

      await client.query('COMMIT');
      return createdPayslips;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
