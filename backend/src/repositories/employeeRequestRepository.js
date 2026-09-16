import { pool } from '../config/db.js';

/**
 * Map employee request row
 */
const mapRequestRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    requestNumber: row.request_number,
    orgId: row.org_id,
    employeeId: row.employee_id,
    requestType: row.request_type,
    subject: row.subject,
    description: row.description,
    status: row.status,
    priority: row.priority,
    assignedTo: row.assigned_to || null,
    assignedTeam: row.assigned_team || '',
    responseNotes: row.response_notes || '',
    resolvedBy: row.resolved_by || null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    rejectionReason: row.rejection_reason || '',
    documentVaultId: row.document_vault_id || null,
    attachmentUrl: row.attachment_url || '',
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    requester: row.e_id
      ? {
          id: row.e_id,
          employeeCode: row.employee_code,
          fullName: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
          email: row.email,
          department: row.dept_name || '',
          userId: row.requester_user_id || null,
        }
      : undefined,
    assignee: row.assignee_id
      ? {
          id: row.assignee_id,
          fullName: `${row.assignee_first_name || ''} ${row.assignee_last_name || ''}`.trim(),
          email: row.assignee_email || '',
        }
      : null,
    resolver: row.resolver_id
      ? {
          id: row.resolver_id,
          fullName: `${row.resolver_first_name || ''} ${row.resolver_last_name || ''}`.trim(),
          email: row.resolver_email || '',
        }
      : null,
    updateCount: row.update_count !== undefined ? parseInt(row.update_count, 10) : undefined,
  };
};

/**
 * Map request update row
 */
const mapUpdateRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    requestId: row.request_id,
    orgId: row.org_id,
    userId: row.user_id,
    message: row.message,
    isInternal: row.is_internal,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    author: row.u_id
      ? {
          id: row.u_id,
          fullName: `${row.u_first_name || ''} ${row.u_last_name || ''}`.trim(),
          email: row.u_email,
          roleName: row.role_name || '',
        }
      : undefined,
  };
};

const BASE_REQUEST_SELECT = `
  SELECT 
    er.*,
    e.id AS e_id, e.employee_code, e.first_name, e.last_name, e.email, e.user_id AS requester_user_id,
    d.name AS dept_name,
    u_assign.id AS assignee_id, u_assign.first_name AS assignee_first_name, u_assign.last_name AS assignee_last_name, u_assign.email AS assignee_email,
    u_res.id AS resolver_id, u_res.first_name AS resolver_first_name, u_res.last_name AS resolver_last_name, u_res.email AS resolver_email,
    (SELECT COUNT(*)::int FROM employee_request_updates eru WHERE eru.request_id = er.id) AS update_count
  FROM employee_requests er
  JOIN employees e ON e.id = er.employee_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN users u_assign ON u_assign.id = er.assigned_to
  LEFT JOIN users u_res ON u_res.id = er.resolved_by
`;

export const employeeRequestRepository = {
  // ==========================================
  // 1. REQUESTS
  // ==========================================

  async findRequests(orgId, filters = {}) {
    let sql = `${BASE_REQUEST_SELECT} WHERE er.org_id = $1`;
    const params = [orgId];

    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND er.status = $${params.length}`;
    }

    if (filters.requestType) {
      params.push(filters.requestType.toUpperCase());
      sql += ` AND er.request_type = $${params.length}`;
    }

    if (filters.priority) {
      params.push(filters.priority.toUpperCase());
      sql += ` AND er.priority = $${params.length}`;
    }

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND er.employee_id = $${params.length}`;
    }

    if (filters.assignedTo) {
      params.push(filters.assignedTo);
      sql += ` AND er.assigned_to = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (er.subject ILIKE $${params.length} OR er.request_number ILIKE $${params.length} OR e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length})`;
    }

    sql += ' ORDER BY er.created_at DESC';

    if (filters.limit) {
      params.push(parseInt(filters.limit, 10));
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(parseInt(filters.offset, 10));
      sql += ` OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows.map(mapRequestRow);
  },

  async findRequestById(id, orgId) {
    const sql = `${BASE_REQUEST_SELECT} WHERE (er.id = $1 OR er.request_number = $1) AND er.org_id = $2 LIMIT 1;`;
    const res = await pool.query(sql, [id, orgId]);
    return mapRequestRow(res.rows[0]);
  },

  async createRequest({ orgId, employeeId, requestType, subject, description, priority = 'MEDIUM', attachmentUrl = '', documentVaultId = null }) {
    const id = `req-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const requestNumber = `REQ-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const sql = `
      INSERT INTO employee_requests (
        id, request_number, org_id, employee_id, request_type, subject,
        description, status, priority, attachment_url, document_vault_id, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING', $8, $9, $10, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id,
      requestNumber,
      orgId,
      employeeId,
      requestType.toUpperCase(),
      subject.trim(),
      description.trim(),
      priority.toUpperCase(),
      attachmentUrl.trim(),
      documentVaultId || null,
    ]);

    return this.findRequestById(res.rows[0].id, orgId);
  },

  async assignRequest(id, orgId, assignedTo, assignedTeam = '') {
    const sql = `
      UPDATE employee_requests
      SET 
        assigned_to = $1,
        assigned_team = COALESCE($2, assigned_team),
        status = CASE WHEN status = 'PENDING' THEN 'IN_PROGRESS' ELSE status END,
        updated_at = NOW()
      WHERE (id = $3 OR request_number = $3) AND org_id = $4
      RETURNING id;
    `;
    const res = await pool.query(sql, [assignedTo || null, assignedTeam, id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findRequestById(res.rows[0].id, orgId);
  },

  async updateStatus(id, orgId, status) {
    const sql = `
      UPDATE employee_requests
      SET status = $1, updated_at = NOW()
      WHERE (id = $2 OR request_number = $2) AND org_id = $3
      RETURNING id;
    `;
    const res = await pool.query(sql, [status.toUpperCase(), id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findRequestById(res.rows[0].id, orgId);
  },

  async resolveRequest(id, orgId, responseNotes, resolvedBy, documentVaultId = null) {
    const sql = `
      UPDATE employee_requests
      SET 
        status = 'RESOLVED',
        response_notes = $1,
        resolved_by = $2,
        resolved_at = NOW(),
        document_vault_id = COALESCE($3, document_vault_id),
        updated_at = NOW()
      WHERE (id = $4 OR request_number = $4) AND org_id = $5
      RETURNING id;
    `;
    const res = await pool.query(sql, [responseNotes.trim(), resolvedBy, documentVaultId || null, id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findRequestById(res.rows[0].id, orgId);
  },

  async rejectRequest(id, orgId, rejectionReason) {
    const sql = `
      UPDATE employee_requests
      SET 
        status = 'REJECTED',
        rejection_reason = $1,
        updated_at = NOW()
      WHERE (id = $2 OR request_number = $2) AND org_id = $3
      RETURNING id;
    `;
    const res = await pool.query(sql, [rejectionReason.trim(), id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findRequestById(res.rows[0].id, orgId);
  },

  async cancelRequest(id, orgId) {
    const sql = `
      UPDATE employee_requests
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE (id = $1 OR request_number = $1) AND org_id = $2
      RETURNING id;
    `;
    const res = await pool.query(sql, [id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findRequestById(res.rows[0].id, orgId);
  },

  // ==========================================
  // 2. UPDATES / CONVERSATION THREAD
  // ==========================================

  async addUpdate({ requestId, orgId, userId, message, isInternal = false }) {
    const id = `erup-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO employee_request_updates (
        id, request_id, org_id, user_id, message, is_internal, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id, requestId, orgId, userId, message.trim(), isInternal
    ]);

    // Touch request updated_at
    await pool.query('UPDATE employee_requests SET updated_at = NOW() WHERE id = $1', [requestId]);

    return this.findUpdateById(res.rows[0].id, orgId);
  },

  async findUpdateById(updateId, orgId) {
    const sql = `
      SELECT 
        eru.*,
        u.id AS u_id, u.first_name AS u_first_name, u.last_name AS u_last_name, u.email AS u_email,
        r.name AS role_name
      FROM employee_request_updates eru
      JOIN users u ON u.id = eru.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE eru.id = $1 AND eru.org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(sql, [updateId, orgId]);
    return mapUpdateRow(res.rows[0]);
  },

  async findUpdatesByRequestId(requestId, orgId, includeInternal = true) {
    let sql = `
      SELECT 
        eru.*,
        u.id AS u_id, u.first_name AS u_first_name, u.last_name AS u_last_name, u.email AS u_email,
        r.name AS role_name
      FROM employee_request_updates eru
      JOIN users u ON u.id = eru.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE eru.request_id = $1 AND eru.org_id = $2
    `;
    const params = [requestId, orgId];

    if (!includeInternal) {
      sql += ' AND eru.is_internal = FALSE';
    }

    sql += ' ORDER BY eru.created_at ASC;';

    const res = await pool.query(sql, params);
    return res.rows.map(mapUpdateRow);
  },

  // ==========================================
  // 3. STATS & METRICS
  // ==========================================

  async getRequestStats(orgId, employeeId = null) {
    let sql = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END)::int AS pending,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::int AS in_progress,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END)::int AS resolved,
        COUNT(CASE WHEN status = 'REJECTED' THEN 1 END)::int AS rejected,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled
      FROM employee_requests
      WHERE org_id = $1
    `;
    const params = [orgId];

    if (employeeId) {
      params.push(employeeId);
      sql += ` AND employee_id = $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows[0];
  },
};
