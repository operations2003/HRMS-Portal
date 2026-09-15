import { pool } from '../config/db.js';

/**
 * Format raw database organization row to API response object
 */
const formatOrg = (row, departmentsCount = 0, employeesCount = 0) => {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    email: row.email,
    phone: row.phone || '',
    website: row.website || '',
    address: row.address || '',
    status: row.status,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    stats: {
      departmentsCount: parseInt(departmentsCount ?? row.departmentsCount ?? 0, 10),
      employeesCount: parseInt(employeesCount ?? row.employeesCount ?? 0, 10),
    },
  };
};

export const orgRepository = {
  /**
   * List organizations with optional search and status filtering
   */
  async findAll({ search = '', status = '' } = {}) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`LOWER(o.status) = LOWER($${paramIndex++})`);
      values.push(status);
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(
        `(LOWER(o.name) LIKE $${paramIndex} OR LOWER(o.code) LIKE $${paramIndex} OR LOWER(o.email) LIKE $${paramIndex})`
      );
      values.push(q);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        o.id,
        o.name,
        o.code,
        o.email,
        o.phone,
        o.website,
        o.address,
        o.status,
        o.created_at AS "createdAt",
        o.updated_at AS "updatedAt",
        COUNT(DISTINCT d.id)::int AS "departmentsCount",
        COUNT(DISTINCT e.id)::int AS "employeesCount"
      FROM organizations o
      LEFT JOIN departments d ON d.org_id = o.id
      LEFT JOIN employees e ON e.org_id = o.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.created_at DESC;
    `;

    const res = await pool.query(sql, values);
    return res.rows.map((row) => formatOrg(row));
  },

  /**
   * Find a single organization by ID with department details and stats
   */
  async findById(id) {
    if (!id || typeof id !== 'string') return null;

    const orgSql = `
      SELECT 
        o.id,
        o.name,
        o.code,
        o.email,
        o.phone,
        o.website,
        o.address,
        o.status,
        o.created_at AS "createdAt",
        o.updated_at AS "updatedAt",
        COUNT(DISTINCT d.id)::int AS "departmentsCount",
        COUNT(DISTINCT e.id)::int AS "employeesCount"
      FROM organizations o
      LEFT JOIN departments d ON d.org_id = o.id
      LEFT JOIN employees e ON e.org_id = o.id
      WHERE o.id = $1
      GROUP BY o.id;
    `;

    const orgRes = await pool.query(orgSql, [id]);
    if (orgRes.rows.length === 0) return null;

    const orgRow = orgRes.rows[0];

    // Fetch department list
    const deptSql = `
      SELECT id, org_id AS "orgId", name, code, status
      FROM departments
      WHERE org_id = $1
      ORDER BY name ASC;
    `;
    const deptsRes = await pool.query(deptSql, [id]);

    const formatted = formatOrg(orgRow);
    return {
      ...formatted,
      departments: deptsRes.rows,
    };
  },

  /**
   * Find organization by unique code
   */
  async findByCode(code) {
    if (!code || typeof code !== 'string') return null;

    const sql = `
      SELECT 
        id,
        name,
        code,
        email,
        phone,
        website,
        address,
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM organizations
      WHERE UPPER(code) = UPPER($1)
      LIMIT 1;
    `;

    const res = await pool.query(sql, [code.trim()]);
    return res.rows.length > 0 ? formatOrg(res.rows[0]) : null;
  },

  /**
   * Create a new organization
   */
  async create(data) {
    const id = data.id || `org-${Date.now()}`;
    const name = data.name ? data.name.trim() : '';
    const code = data.code ? data.code.trim().toUpperCase() : '';
    const email = data.email ? data.email.trim().toLowerCase() : '';
    const phone = data.phone || '';
    const website = data.website || '';
    const address = data.address || '';
    const status = data.status || 'Active';

    const sql = `
      INSERT INTO organizations (id, name, code, email, phone, website, address, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id,
        name,
        code,
        email,
        phone,
        website,
        address,
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    const res = await pool.query(sql, [id, name, code, email, phone, website, address, status]);
    return formatOrg(res.rows[0], 0, 0);
  },

  /**
   * Update an existing organization
   */
  async update(id, data) {
    if (!id || typeof id !== 'string') return null;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(data.name.trim());
    }

    if (data.code !== undefined) {
      setClauses.push(`code = $${paramIndex++}`);
      values.push(data.code.trim().toUpperCase());
    }

    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(data.email.trim().toLowerCase());
    }

    if (data.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(data.phone || '');
    }

    if (data.website !== undefined) {
      setClauses.push(`website = $${paramIndex++}`);
      values.push(data.website || '');
    }

    if (data.address !== undefined) {
      setClauses.push(`address = $${paramIndex++}`);
      values.push(data.address || '');
    }

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE organizations
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        name,
        code,
        email,
        phone,
        website,
        address,
        status,
        created_at AS "createdAt",
        updated_at AS "updatedAt";
    `;

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;

    return this.findById(id);
  },

  /**
   * Delete an organization by ID
   */
  async delete(id) {
    if (!id || typeof id !== 'string') return false;

    const res = await pool.query('DELETE FROM organizations WHERE id = $1;', [id]);
    return res.rowCount > 0;
  },
};
