import { pool } from '../config/db.js';

export const departmentRepository = {
  /**
   * List all departments with employee counts
   */
  async findAll(orgId = 'org-1') {
    const sql = `
      SELECT 
        d.id,
        d.org_id AS "orgId",
        d.name,
        d.code,
        d.description,
        d.status,
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        COUNT(e.id)::int AS "employeesCount"
      FROM departments d
      LEFT JOIN employees e ON e.dept_id = d.id
      WHERE d.org_id = $1
      GROUP BY d.id
      ORDER BY d.name ASC;
    `;
    const res = await pool.query(sql, [orgId]);
    return res.rows;
  },

  /**
   * Find single department by ID
   */
  async findById(id, orgId = 'org-1') {
    const sql = `
      SELECT 
        d.id,
        d.org_id AS "orgId",
        d.name,
        d.code,
        d.description,
        d.status,
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        COUNT(e.id)::int AS "employeesCount"
      FROM departments d
      LEFT JOIN employees e ON e.dept_id = d.id
      WHERE d.id = $1 AND d.org_id = $2
      GROUP BY d.id;
    `;
    const res = await pool.query(sql, [id, orgId]);
    return res.rows[0] || null;
  },

  /**
   * Find department by code (case-insensitive)
   */
  async findByCode(code, orgId = 'org-1') {
    const sql = 'SELECT * FROM departments WHERE LOWER(code) = LOWER($1) AND org_id = $2;';
    const res = await pool.query(sql, [code, orgId]);
    return res.rows[0] || null;
  },

  /**
   * Create a new department
   */
  async create({ orgId = 'org-1', name, code, description = '', status = 'Active' }) {
    const id = `dept-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO departments (id, org_id, name, code, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, org_id AS "orgId", name, code, description, status, created_at AS "createdAt", updated_at AS "updatedAt";
    `;
    const res = await pool.query(sql, [
      id,
      orgId,
      name.trim(),
      code.trim().toUpperCase(),
      description?.trim() || '',
      status,
    ]);
    return res.rows[0];
  },

  /**
   * Update existing department
   */
  async update(id, orgId = 'org-1', { name, code, description, status }) {
    const sql = `
      UPDATE departments
      SET 
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        updated_at = NOW()
      WHERE id = $5 AND org_id = $6
      RETURNING id, org_id AS "orgId", name, code, description, status, created_at AS "createdAt", updated_at AS "updatedAt";
    `;
    const res = await pool.query(sql, [
      name ? name.trim() : null,
      code ? code.trim().toUpperCase() : null,
      description !== undefined ? description.trim() : null,
      status || null,
      id,
      orgId,
    ]);
    return res.rows[0] || null;
  },

  /**
   * Delete department (enforcing employee reference constraint)
   */
  async delete(id, orgId = 'org-1') {
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM employees WHERE dept_id = $1', [id]);
    if (countRes.rows[0]?.count > 0) {
      const error = new Error(`Cannot delete department: ${countRes.rows[0].count} employee(s) are currently assigned to it.`);
      error.statusCode = 400;
      throw error;
    }
    const sql = 'DELETE FROM departments WHERE id = $1 AND org_id = $2 RETURNING id;';
    const res = await pool.query(sql, [id, orgId]);
    return res.rows[0] || null;
  },
};
