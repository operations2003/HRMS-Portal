import { pool } from '../config/db.js';

export const designationRepository = {
  /**
   * List all designations with employee counts
   */
  async findAll(orgId = 'org-1') {
    const sql = `
      SELECT 
        d.id,
        d.org_id AS "orgId",
        d.title,
        d.code,
        d.status,
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        COUNT(e.id)::int AS "employeesCount"
      FROM designations d
      LEFT JOIN employees e ON e.desig_id = d.id
      WHERE d.org_id = $1
      GROUP BY d.id
      ORDER BY d.title ASC;
    `;
    const res = await pool.query(sql, [orgId]);
    return res.rows;
  },

  /**
   * Find single designation by ID
   */
  async findById(id, orgId = 'org-1') {
    const sql = `
      SELECT 
        d.id,
        d.org_id AS "orgId",
        d.title,
        d.code,
        d.status,
        d.created_at AS "createdAt",
        d.updated_at AS "updatedAt",
        COUNT(e.id)::int AS "employeesCount"
      FROM designations d
      LEFT JOIN employees e ON e.desig_id = d.id
      WHERE d.id = $1 AND d.org_id = $2
      GROUP BY d.id;
    `;
    const res = await pool.query(sql, [id, orgId]);
    return res.rows[0] || null;
  },

  /**
   * Find designation by code (case-insensitive)
   */
  async findByCode(code, orgId = 'org-1') {
    const sql = 'SELECT * FROM designations WHERE LOWER(code) = LOWER($1) AND org_id = $2;';
    const res = await pool.query(sql, [code, orgId]);
    return res.rows[0] || null;
  },

  /**
   * Create a new designation
   */
  async create({ orgId = 'org-1', title, code, status = 'Active' }) {
    const id = `desig-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const sql = `
      INSERT INTO designations (id, org_id, title, code, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING id, org_id AS "orgId", title, code, status, created_at AS "createdAt", updated_at AS "updatedAt";
    `;
    const res = await pool.query(sql, [
      id,
      orgId,
      title.trim(),
      code.trim().toUpperCase(),
      status,
    ]);
    return res.rows[0];
  },

  /**
   * Update existing designation
   */
  async update(id, orgId = 'org-1', { title, code, status }) {
    const sql = `
      UPDATE designations
      SET 
        title = COALESCE($1, title),
        code = COALESCE($2, code),
        status = COALESCE($3, status),
        updated_at = NOW()
      WHERE id = $4 AND org_id = $5
      RETURNING id, org_id AS "orgId", title, code, status, created_at AS "createdAt", updated_at AS "updatedAt";
    `;
    const res = await pool.query(sql, [
      title ? title.trim() : null,
      code ? code.trim().toUpperCase() : null,
      status || null,
      id,
      orgId,
    ]);
    return res.rows[0] || null;
  },

  /**
   * Delete designation (enforcing employee reference constraint)
   */
  async delete(id, orgId = 'org-1') {
    const countRes = await pool.query('SELECT COUNT(*)::int AS count FROM employees WHERE desig_id = $1', [id]);
    if (countRes.rows[0]?.count > 0) {
      const error = new Error(`Cannot delete designation: ${countRes.rows[0].count} employee(s) are currently assigned to it.`);
      error.statusCode = 400;
      throw error;
    }
    const sql = 'DELETE FROM designations WHERE id = $1 AND org_id = $2 RETURNING id;';
    const res = await pool.query(sql, [id, orgId]);
    return res.rows[0] || null;
  },
};
