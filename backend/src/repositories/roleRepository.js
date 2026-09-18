import { pool } from '../config/db.js';

export const roleRepository = {
  /**
   * Find all system roles with aggregated permission codes
   */
  async findAllRoles() {
    const sql = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.status,
        COALESCE(ARRAY_AGG(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      GROUP BY r.id
      ORDER BY r.name ASC;
    `;
    const res = await pool.query(sql);
    return res.rows;
  },

  /**
   * Find a role by its ID with aggregated permission codes
   */
  async findRoleById(id) {
    if (!id || typeof id !== 'string') return null;

    const sql = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.status,
        COALESCE(ARRAY_AGG(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE r.id = $1
      GROUP BY r.id;
    `;
    const res = await pool.query(sql, [id]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Find a role by name (case-insensitive) with permissions
   */
  async findRoleByName(name) {
    if (!name || typeof name !== 'string') return null;

    const sql = `
      SELECT 
        r.id,
        r.name,
        r.description,
        r.status,
        COALESCE(ARRAY_AGG(p.code) FILTER (WHERE p.code IS NOT NULL), '{}') AS permissions
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      LEFT JOIN permissions p ON p.id = rp.permission_id
      WHERE LOWER(r.name) = LOWER($1)
      GROUP BY r.id;
    `;
    const res = await pool.query(sql, [name.trim()]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Find all system permissions
   */
  async findAllPermissions() {
    const sql = `
      SELECT id, code, name, module, description
      FROM permissions
      ORDER BY module ASC, code ASC;
    `;
    const res = await pool.query(sql);
    return res.rows;
  },

  /**
   * Assign a permission to a role in role_permissions table (accepts permission id or code)
   */
  async assignPermission(roleId, permissionIdentifier) {
    if (!permissionIdentifier || typeof permissionIdentifier !== 'string') return null;
    let permId = permissionIdentifier.trim();
    const p = await pool.query('SELECT id FROM permissions WHERE id = $1 OR LOWER(code) = LOWER($1) LIMIT 1;', [permId]);
    if (p.rows.length > 0) permId = p.rows[0].id;

    const sql = `
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      RETURNING role_id, permission_id;
    `;
    const res = await pool.query(sql, [roleId, permId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Revoke a permission from a role (accepts permission id or code)
   */
  async revokePermission(roleId, permissionIdentifier) {
    if (!permissionIdentifier || typeof permissionIdentifier !== 'string') return null;
    let permId = permissionIdentifier.trim();
    const p = await pool.query('SELECT id FROM permissions WHERE id = $1 OR LOWER(code) = LOWER($1) LIMIT 1;', [permId]);
    if (p.rows.length > 0) permId = p.rows[0].id;

    const sql = `
      DELETE FROM role_permissions
      WHERE role_id = $1 AND permission_id = $2
      RETURNING role_id, permission_id;
    `;
    const res = await pool.query(sql, [roleId, permId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },

  /**
   * Find permission by ID
   */
  async findPermissionById(id) {
    if (!id || typeof id !== 'string') return null;
    const res = await pool.query('SELECT * FROM permissions WHERE id = $1;', [id]);
    return res.rows[0] || null;
  },

  /**
   * Find permission by unique code
   */
  async findPermissionByCode(code) {
    if (!code || typeof code !== 'string') return null;
    const res = await pool.query('SELECT * FROM permissions WHERE LOWER(code) = LOWER($1);', [code.trim()]);
    return res.rows[0] || null;
  },

  /**
   * Create a new role
   */
  async createRole({ id, name, description = '', status = 'Active' }) {
    const roleId = id || `role-${Date.now()}`;
    const sql = `
      INSERT INTO roles (id, name, description, status)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, description, status, created_at;
    `;
    const res = await pool.query(sql, [roleId, name.trim(), description, status]);
    return this.findRoleById(roleId);
  },

  /**
   * Update an existing role
   */
  async updateRole(id, data = {}) {
    const fields = [];
    const values = [];
    let idx = 1;

    if (data.name !== undefined) {
      fields.push(`name = $${idx++}`);
      values.push(data.name.trim());
    }
    if (data.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(data.description);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
    }

    if (fields.length > 0) {
      fields.push(`updated_at = NOW()`);
      values.push(id);
      const sql = `
        UPDATE roles
        SET ${fields.join(', ')}
        WHERE id = $${idx}
        RETURNING *;
      `;
      await pool.query(sql, values);
    }

    return this.findRoleById(id);
  },

  /**
   * Replace all permissions for a role in one transaction (accepts permission IDs or codes)
   */
  async syncRolePermissions(roleId, permissionIdentifiers = []) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM role_permissions WHERE role_id = $1;', [roleId]);
      for (const item of permissionIdentifiers) {
        if (!item || typeof item !== 'string') continue;
        const pRes = await client.query(
          'SELECT id FROM permissions WHERE id = $1 OR LOWER(code) = LOWER($1) LIMIT 1;',
          [item.trim()]
        );
        if (pRes.rows.length > 0) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING;',
            [roleId, pRes.rows[0].id]
          );
        }
      }
      await client.query('COMMIT');
      return this.findRoleById(roleId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },
};
