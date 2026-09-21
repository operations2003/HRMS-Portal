import { pool } from '../config/db.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import crypto from 'crypto';

export const policyController = {
  /**
   * Helper: Check if user is HR or Admin
   */
  isHrOrAdmin(user) {
    const role = (user?.roleName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['admin', 'superadmin', 'hr', 'hrmanager', 'orgadmin'].includes(role);
  },

  /**
   * GET /api/v1/policies
   * Accessible by all authenticated users (Employees, Managers, HR, Admin)
   */
  async listPolicies(req, res, next) {
    try {
      const orgId = req.user?.orgId;
      const { category, search } = req.query;

      let query = `
        SELECT p.*, u.first_name as author_first_name, u.last_name as author_last_name
        FROM company_policies p
        LEFT JOIN users u ON p.created_by = u.id
        WHERE (p.org_id = $1 OR p.org_id IS NULL)
      `;
      const params = [orgId];

      if (category && category.trim()) {
        params.push(category.trim());
        query += ` AND p.category = $${params.length}`;
      }

      if (search && search.trim()) {
        params.push(`%${search.trim().toLowerCase()}%`);
        query += ` AND (LOWER(p.title) LIKE $${params.length} OR LOWER(p.description) LIKE $${params.length})`;
      }

      query += ` ORDER BY p.created_at DESC;`;

      const result = await pool.query(query, params);
      return sendSuccess(res, 'Company policies retrieved successfully.', result.rows);
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/policies/:id
   */
  async getPolicyById(req, res, next) {
    try {
      const { id } = req.params;
      const resQuery = await pool.query(
        `SELECT p.*, u.first_name as author_first_name, u.last_name as author_last_name
         FROM company_policies p
         LEFT JOIN users u ON p.created_by = u.id
         WHERE p.id = $1;`,
        [id]
      );
      if (resQuery.rows.length === 0) {
        return sendError(res, 'Policy document not found.', 404);
      }
      return sendSuccess(res, 'Policy details fetched.', resQuery.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/policies
   * Restricted: Only HR & Admin can create policies.
   */
  async createPolicy(req, res, next) {
    try {
      if (!policyController.isHrOrAdmin(req.user)) {
        return sendError(res, 'Access denied: Only HR and Admin administrators are authorized to publish company policies.', 403);
      }

      const { title, category, description, version, effectiveDate, documentUrl } = req.body;
      if (!title || !title.trim()) {
        return sendError(res, 'Policy title is required.', 400);
      }

      const id = 'pol-' + crypto.randomUUID().slice(0, 12);
      const query = `
        INSERT INTO company_policies (id, org_id, title, category, description, version, effective_date, document_url, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const values = [
        id,
        req.user.orgId,
        title.trim(),
        category?.trim() || 'General',
        description?.trim() || '',
        version?.trim() || '1.0',
        effectiveDate || new Date().toISOString().split('T')[0],
        documentUrl || '',
        req.user.id,
      ];

      const created = await pool.query(query, values);
      return sendSuccess(res, 'Company policy published successfully.', created.rows[0], 201);
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/policies/:id
   * Restricted: Only HR & Admin can update policies.
   */
  async updatePolicy(req, res, next) {
    try {
      if (!policyController.isHrOrAdmin(req.user)) {
        return sendError(res, 'Access denied: Only HR and Admin administrators are authorized to update company policies.', 403);
      }

      const { id } = req.params;
      const { title, category, description, version, effectiveDate, documentUrl } = req.body;

      const updateQuery = `
        UPDATE company_policies
        SET 
          title = COALESCE($1, title),
          category = COALESCE($2, category),
          description = COALESCE($3, description),
          version = COALESCE($4, version),
          effective_date = COALESCE($5, effective_date),
          document_url = COALESCE($6, document_url),
          updated_at = NOW()
        WHERE id = $7
        RETURNING *;
      `;
      const values = [title, category, description, version, effectiveDate, documentUrl, id];
      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return sendError(res, 'Policy document not found.', 404);
      }

      return sendSuccess(res, 'Company policy updated successfully.', result.rows[0]);
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/policies/:id
   * Restricted: Only HR & Admin can delete policies.
   */
  async deletePolicy(req, res, next) {
    try {
      if (!policyController.isHrOrAdmin(req.user)) {
        return sendError(res, 'Access denied: Only HR and Admin administrators are authorized to delete company policies.', 403);
      }

      const { id } = req.params;
      const result = await pool.query(`DELETE FROM company_policies WHERE id = $1 RETURNING id;`, [id]);
      if (result.rows.length === 0) {
        return sendError(res, 'Policy document not found.', 404);
      }

      return sendSuccess(res, 'Company policy removed successfully.', { id });
    } catch (error) {
      next(error);
    }
  },
};
