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
   * Assign a permission to a role in role_permissions table
   */
  async assignPermission(roleId, permissionId) {
    const sql = `
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT (role_id, permission_id) DO NOTHING
      RETURNING role_id, permission_id;
    `;
    const res = await pool.query(sql, [roleId, permissionId]);
    return res.rows.length > 0 ? res.rows[0] : null;
  },
};
