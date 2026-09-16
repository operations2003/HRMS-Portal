import { pool } from '../config/db.js';

/**
 * Maps database row to structured Helpdesk Ticket object
 */
const mapTicketRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    ticketNumber: row.ticket_number,
    orgId: row.org_id,
    employeeId: row.employee_id,
    category: row.category,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    status: row.status,
    assignedTo: row.assigned_to || null,
    assignedTeam: row.assigned_team || '',
    resolution: row.resolution || '',
    resolvedBy: row.resolved_by || null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at).toISOString() : null,
    closedAt: row.closed_at ? new Date(row.closed_at).toISOString() : null,
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
    commentCount: row.comment_count !== undefined ? parseInt(row.comment_count, 10) : undefined,
  };
};

/**
 * Maps comment row
 */
const mapCommentRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    ticketId: row.ticket_id,
    orgId: row.org_id,
    userId: row.user_id,
    comment: row.comment,
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

const BASE_TICKET_SELECT = `
  SELECT 
    ht.*,
    e.id AS e_id, e.employee_code, e.first_name, e.last_name, e.email, e.user_id AS requester_user_id,
    d.name AS dept_name,
    u_assign.id AS assignee_id, u_assign.first_name AS assignee_first_name, u_assign.last_name AS assignee_last_name, u_assign.email AS assignee_email,
    u_res.id AS resolver_id, u_res.first_name AS resolver_first_name, u_res.last_name AS resolver_last_name, u_res.email AS resolver_email,
    (SELECT COUNT(*)::int FROM ticket_comments tc WHERE tc.ticket_id = ht.id) AS comment_count
  FROM helpdesk_tickets ht
  JOIN employees e ON e.id = ht.employee_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN users u_assign ON u_assign.id = ht.assigned_to
  LEFT JOIN users u_res ON u_res.id = ht.resolved_by
`;

export const helpdeskRepository = {
  // ==========================================
  // 1. TICKETS
  // ==========================================

  async findTickets(orgId, filters = {}) {
    let sql = `${BASE_TICKET_SELECT} WHERE ht.org_id = $1`;
    const params = [orgId];

    if (filters.status) {
      params.push(filters.status.toUpperCase());
      sql += ` AND ht.status = $${params.length}`;
    }

    if (filters.category) {
      params.push(filters.category.toUpperCase());
      sql += ` AND ht.category = $${params.length}`;
    }

    if (filters.priority) {
      params.push(filters.priority.toUpperCase());
      sql += ` AND ht.priority = $${params.length}`;
    }

    if (filters.employeeId) {
      params.push(filters.employeeId);
      sql += ` AND ht.employee_id = $${params.length}`;
    }

    if (filters.assignedTo) {
      params.push(filters.assignedTo);
      sql += ` AND ht.assigned_to = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      sql += ` AND (ht.subject ILIKE $${params.length} OR ht.ticket_number ILIKE $${params.length} OR e.first_name ILIKE $${params.length} OR e.last_name ILIKE $${params.length})`;
    }

    sql += ' ORDER BY ht.created_at DESC';

    if (filters.limit) {
      params.push(parseInt(filters.limit, 10));
      sql += ` LIMIT $${params.length}`;
    }

    if (filters.offset) {
      params.push(parseInt(filters.offset, 10));
      sql += ` OFFSET $${params.length}`;
    }

    const res = await pool.query(sql, params);
    return res.rows.map(mapTicketRow);
  },

  async findTicketById(id, orgId) {
    const sql = `${BASE_TICKET_SELECT} WHERE (ht.id = $1 OR ht.ticket_number = $1) AND ht.org_id = $2 LIMIT 1;`;
    const res = await pool.query(sql, [id, orgId]);
    return mapTicketRow(res.rows[0]);
  },

  async createTicket({ orgId, employeeId, category, subject, description, priority = 'MEDIUM', attachmentUrl = '' }) {
    const id = `tick-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const ticketNumber = `HD-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

    const sql = `
      INSERT INTO helpdesk_tickets (
        id, ticket_number, org_id, employee_id, category, subject, description,
        priority, status, attachment_url, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'OPEN', $9, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id,
      ticketNumber,
      orgId,
      employeeId,
      category.toUpperCase(),
      subject.trim(),
      description.trim(),
      priority.toUpperCase(),
      attachmentUrl.trim(),
    ]);

    return this.findTicketById(res.rows[0].id, orgId);
  },

  async assignTicket(id, orgId, assignedTo, assignedTeam = '') {
    const sql = `
      UPDATE helpdesk_tickets
      SET 
        assigned_to = $1,
        assigned_team = COALESCE($2, assigned_team),
        status = CASE WHEN status = 'OPEN' THEN 'IN_PROGRESS' ELSE status END,
        updated_at = NOW()
      WHERE (id = $3 OR ticket_number = $3) AND org_id = $4
      RETURNING id;
    `;
    const res = await pool.query(sql, [assignedTo || null, assignedTeam, id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findTicketById(res.rows[0].id, orgId);
  },

  async updateStatus(id, orgId, status) {
    const sql = `
      UPDATE helpdesk_tickets
      SET status = $1, updated_at = NOW()
      WHERE (id = $2 OR ticket_number = $2) AND org_id = $3
      RETURNING id;
    `;
    const res = await pool.query(sql, [status.toUpperCase(), id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findTicketById(res.rows[0].id, orgId);
  },

  async resolveTicket(id, orgId, resolution, resolvedBy) {
    const sql = `
      UPDATE helpdesk_tickets
      SET 
        status = 'RESOLVED',
        resolution = $1,
        resolved_by = $2,
        resolved_at = NOW(),
        updated_at = NOW()
      WHERE (id = $3 OR ticket_number = $3) AND org_id = $4
      RETURNING id;
    `;
    const res = await pool.query(sql, [resolution.trim(), resolvedBy, id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findTicketById(res.rows[0].id, orgId);
  },

  async closeTicket(id, orgId) {
    const sql = `
      UPDATE helpdesk_tickets
      SET 
        status = 'CLOSED',
        closed_at = NOW(),
        resolved_at = COALESCE(resolved_at, NOW()),
        updated_at = NOW()
      WHERE (id = $1 OR ticket_number = $1) AND org_id = $2
      RETURNING id;
    `;
    const res = await pool.query(sql, [id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findTicketById(res.rows[0].id, orgId);
  },

  async cancelTicket(id, orgId) {
    const sql = `
      UPDATE helpdesk_tickets
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE (id = $1 OR ticket_number = $1) AND org_id = $2
      RETURNING id;
    `;
    const res = await pool.query(sql, [id, orgId]);
    if (res.rows.length === 0) return null;
    return this.findTicketById(res.rows[0].id, orgId);
  },

  // ==========================================
  // 2. COMMENTS & CONVERSATION THREAD
  // ==========================================

  async addComment({ ticketId, orgId, userId, comment, isInternal = false }) {
    const id = `tcom-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO ticket_comments (
        id, ticket_id, org_id, user_id, comment, is_internal, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING *;
    `;
    const res = await pool.query(sql, [
      id, ticketId, orgId, userId, comment.trim(), isInternal
    ]);

    // Touch ticket updated_at
    await pool.query('UPDATE helpdesk_tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);

    return this.findCommentById(res.rows[0].id, orgId);
  },

  async findCommentById(commentId, orgId) {
    const sql = `
      SELECT 
        tc.*,
        u.id AS u_id, u.first_name AS u_first_name, u.last_name AS u_last_name, u.email AS u_email,
        r.name AS role_name
      FROM ticket_comments tc
      JOIN users u ON u.id = tc.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE tc.id = $1 AND tc.org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(sql, [commentId, orgId]);
    return mapCommentRow(res.rows[0]);
  },

  async findCommentsByTicketId(ticketId, orgId, includeInternal = true) {
    let sql = `
      SELECT 
        tc.*,
        u.id AS u_id, u.first_name AS u_first_name, u.last_name AS u_last_name, u.email AS u_email,
        r.name AS role_name
      FROM ticket_comments tc
      JOIN users u ON u.id = tc.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE tc.ticket_id = $1 AND tc.org_id = $2
    `;
    const params = [ticketId, orgId];

    if (!includeInternal) {
      sql += ' AND tc.is_internal = FALSE';
    }

    sql += ' ORDER BY tc.created_at ASC;';

    const res = await pool.query(sql, params);
    return res.rows.map(mapCommentRow);
  },

  // ==========================================
  // 3. STATS & METRICS
  // ==========================================

  async getTicketStats(orgId, employeeId = null) {
    let sql = `
      SELECT 
        COUNT(*)::int AS total,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END)::int AS open,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END)::int AS in_progress,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END)::int AS resolved,
        COUNT(CASE WHEN status = 'CLOSED' THEN 1 END)::int AS closed,
        COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END)::int AS cancelled
      FROM helpdesk_tickets
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
