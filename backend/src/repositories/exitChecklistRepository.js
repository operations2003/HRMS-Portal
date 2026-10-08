import { pool } from '../config/db.js';

const DEFAULT_CHECKLIST_ITEMS = [
  'Resignation Approved',
  'Knowledge Transfer Completed',
  'Company Assets Returned',
  'System Access Revoked',
  'Full & Final Settlement Completed',
];

const formatDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) {
    const year = val.getFullYear();
    const month = String(val.getMonth() + 1).padStart(2, '0');
    const day = String(val.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(val);
};

const mapChecklistRow = (row, items = []) => {
  if (!row) return null;
  const fullName = `${row.first_name || ''} ${row.last_name || ''}`.trim() || row.employee_name || 'Staff';
  return {
    id: row.id,
    orgId: row.org_id,
    employeeId: row.employee_id,
    employeeCode: row.employee_code,
    employeeName: fullName,
    employeeEmail: row.email,
    avatarUrl: row.avatar_url || null,
    department: row.department_name || '',
    designation: row.designation_title || '',
    resignationDate: formatDate(row.resignation_date),
    lastWorkingDay: formatDate(row.last_working_day),
    status: row.status,
    notes: row.notes || '',
    createdBy: row.created_by,
    createdByName: row.created_by_name || null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    completedBy: row.completed_by,
    completedByName: row.completed_by_name || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    items: items.map(mapItemRow),
    totalItems: items.length,
    completedItemsCount: items.filter((i) => i.status === 'Completed').length,
    isAllItemsCompleted: items.length > 0 && items.every((i) => i.status === 'Completed'),
  };
};

const mapItemRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    checklistId: row.checklist_id,
    title: row.title,
    status: row.status,
    notes: row.notes || '',
    orderIndex: row.order_index,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    completedBy: row.completed_by,
    completedByName: row.completed_by_name || null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
};

const BASE_CHECKLIST_SELECT = `
  SELECT 
    ec.*,
    e.first_name,
    e.last_name,
    e.employee_code,
    e.email,
    e.avatar_url,
    d.name AS department_name,
    ds.title AS designation_title,
    u_creator.first_name || ' ' || COALESCE(u_creator.last_name, '') AS created_by_name,
    u_completer.first_name || ' ' || COALESCE(u_completer.last_name, '') AS completed_by_name
  FROM exit_checklists ec
  JOIN employees e ON ec.employee_id = e.id
  LEFT JOIN departments d ON e.dept_id = d.id
  LEFT JOIN designations ds ON e.desig_id = ds.id
  LEFT JOIN users u_creator ON ec.created_by = u_creator.id
  LEFT JOIN users u_completer ON ec.completed_by = u_completer.id
`;

export const exitChecklistRepository = {
  DEFAULT_CHECKLIST_ITEMS,

  /**
   * Create exit checklist and automatically generate the 5 required checklist items
   */
  async create({ orgId, employeeId, resignationDate, lastWorkingDay, createdBy, notes = '' }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const checklistId = `chk-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const insertChecklistQuery = `
        INSERT INTO exit_checklists (
          id, org_id, employee_id, resignation_date, last_working_day, status, created_by, notes
        )
        VALUES ($1, $2, $3, $4, $5, 'In Progress', $6, $7)
        RETURNING *;
      `;
      const checklistRes = await client.query(insertChecklistQuery, [
        checklistId,
        orgId,
        employeeId,
        resignationDate,
        lastWorkingDay,
        createdBy || null,
        notes,
      ]);

      const itemsCreated = [];
      for (let i = 0; i < DEFAULT_CHECKLIST_ITEMS.length; i++) {
        const itemId = `chki-${Date.now()}-${i}-${Math.floor(Math.random() * 1000)}`;
        const insertItemQuery = `
          INSERT INTO exit_checklist_items (
            id, checklist_id, title, status, order_index
          )
          VALUES ($1, $2, $3, 'Pending', $4)
          RETURNING *;
        `;
        const itemRes = await client.query(insertItemQuery, [
          itemId,
          checklistId,
          DEFAULT_CHECKLIST_ITEMS[i],
          i,
        ]);
        itemsCreated.push(itemRes.rows[0]);
      }

      await client.query('COMMIT');

      return this.findById(checklistId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  /**
   * Find checklist by ID
   */
  async findById(id) {
    const query = `${BASE_CHECKLIST_SELECT} WHERE ec.id = $1;`;
    const { rows } = await pool.query(query, [id]);
    if (!rows[0]) return null;

    const itemsQuery = `
      SELECT 
        eci.*,
        u.first_name || ' ' || COALESCE(u.last_name, '') AS completed_by_name
      FROM exit_checklist_items eci
      LEFT JOIN users u ON eci.completed_by = u.id
      WHERE eci.checklist_id = $1
      ORDER BY eci.order_index ASC, eci.created_at ASC;
    `;
    const itemsRes = await pool.query(itemsQuery, [id]);

    return mapChecklistRow(rows[0], itemsRes.rows);
  },

  /**
   * Find active checklist by employee ID
   */
  async findActiveByEmployeeId(employeeId, orgId) {
    const query = `
      ${BASE_CHECKLIST_SELECT}
      WHERE ec.employee_id = $1 AND ec.org_id = $2
      ORDER BY 
        CASE WHEN ec.status = 'In Progress' THEN 1 ELSE 2 END,
        ec.created_at DESC
      LIMIT 1;
    `;
    const { rows } = await pool.query(query, [employeeId, orgId]);
    if (!rows[0]) return null;

    const itemsQuery = `
      SELECT 
        eci.*,
        u.first_name || ' ' || COALESCE(u.last_name, '') AS completed_by_name
      FROM exit_checklist_items eci
      LEFT JOIN users u ON eci.completed_by = u.id
      WHERE eci.checklist_id = $1
      ORDER BY eci.order_index ASC, eci.created_at ASC;
    `;
    const itemsRes = await pool.query(itemsQuery, [rows[0].id]);

    return mapChecklistRow(rows[0], itemsRes.rows);
  },

  /**
   * Find all checklists for an organization (HR & Admin)
   */
  async findAll({ orgId, employeeId = null, status = null, search = null, limit = 50, offset = 0 } = {}) {
    const conditions = ['ec.org_id = $1'];
    const params = [orgId];
    let idx = 2;

    if (employeeId) {
      conditions.push(`ec.employee_id = $${idx++}`);
      params.push(employeeId);
    }

    if (status) {
      conditions.push(`ec.status ILIKE $${idx++}`);
      params.push(status);
    }

    if (search && search.trim()) {
      conditions.push(`(
        e.first_name ILIKE $${idx} OR 
        e.last_name ILIKE $${idx} OR 
        e.employee_code ILIKE $${idx} OR 
        e.email ILIKE $${idx}
      )`);
      params.push(`%${search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.join(' AND ');
    const countQuery = `
      SELECT COUNT(*)::int AS total 
      FROM exit_checklists ec
      JOIN employees e ON ec.employee_id = e.id
      WHERE ${whereClause};
    `;
    const { rows: countRows } = await pool.query(countQuery, params);
    const total = countRows[0]?.total || 0;

    const dataQuery = `
      ${BASE_CHECKLIST_SELECT}
      WHERE ${whereClause}
      ORDER BY ec.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++};
    `;
    params.push(limit, offset);

    const { rows } = await pool.query(dataQuery, params);
    if (!rows || rows.length === 0) {
      return { items: [], total, limit, offset };
    }

    const checklistIds = rows.map((r) => r.id);
    const itemsQuery = `
      SELECT 
        eci.*,
        u.first_name || ' ' || COALESCE(u.last_name, '') AS completed_by_name
      FROM exit_checklist_items eci
      LEFT JOIN users u ON eci.completed_by = u.id
      WHERE eci.checklist_id = ANY($1::varchar[])
      ORDER BY eci.order_index ASC, eci.created_at ASC;
    `;
    const itemsRes = await pool.query(itemsQuery, [checklistIds]);

    const itemsByChecklistId = {};
    for (const item of itemsRes.rows) {
      if (!itemsByChecklistId[item.checklist_id]) {
        itemsByChecklistId[item.checklist_id] = [];
      }
      itemsByChecklistId[item.checklist_id].push(item);
    }

    const items = rows.map((r) => mapChecklistRow(r, itemsByChecklistId[r.id] || []));

    return { items, total, limit, offset };
  },

  /**
   * Find single checklist item by ID
   */
  async findItemById(itemId) {
    const query = `
      SELECT 
        eci.*,
        ec.org_id,
        ec.employee_id,
        ec.status AS checklist_status
      FROM exit_checklist_items eci
      JOIN exit_checklists ec ON eci.checklist_id = ec.id
      WHERE eci.id = $1;
    `;
    const { rows } = await pool.query(query, [itemId]);
    return rows[0] || null;
  },

  /**
   * Update checklist item status (Pending / Completed)
   */
  async updateItemStatus(itemId, { status, completedBy = null, notes = null }) {
    const query = `
      UPDATE exit_checklist_items
      SET 
        status = $1::varchar,
        completed_at = CASE WHEN $1::varchar = 'Completed' THEN NOW() ELSE NULL END,
        completed_by = CASE WHEN $1::varchar = 'Completed' THEN $2::varchar ELSE NULL END,
        notes = COALESCE($3, notes),
        updated_at = NOW()
      WHERE id = $4::varchar
      RETURNING *;
    `;
    const { rows } = await pool.query(query, [status, completedBy, notes, itemId]);
    return rows[0] ? mapItemRow(rows[0]) : null;
  },

  /**
   * Mark exit checklist as completed
   */
  async markChecklistCompleted(checklistId, completedBy) {
    const query = `
      UPDATE exit_checklists
      SET 
        status = 'Completed',
        completed_at = NOW(),
        completed_by = $1,
        updated_at = NOW()
      WHERE id = $2
      RETURNING *;
    `;
    await pool.query(query, [completedBy, checklistId]);
    return this.findById(checklistId);
  },

  /**
   * Delete / Cancel checklist
   */
  async deleteChecklist(checklistId) {
    const query = `DELETE FROM exit_checklists WHERE id = $1 RETURNING *;`;
    const { rows } = await pool.query(query, [checklistId]);
    return rows[0] || null;
  },
};
