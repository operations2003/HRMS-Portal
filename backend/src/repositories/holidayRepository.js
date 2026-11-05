import { pool } from '../config/db.js';

export const holidayRepository = {
  /**
   * Find all holidays for an organization with optional filters
   */
  async findAll(orgId, { year = null, status = null } = {}) {
    const conditions = ['org_id = $1'];
    const values = [orgId];
    let idx = 2;

    if (year) {
      conditions.push(`EXTRACT(YEAR FROM holiday_date) = $${idx++}`);
      values.push(parseInt(year, 10));
    }

    if (status) {
      conditions.push(`LOWER(status) = LOWER($${idx++})`);
      values.push(status);
    }

    const sql = `
      SELECT id, org_id AS "orgId", name, 
             TO_CHAR(holiday_date, 'YYYY-MM-DD') AS "holidayDate",
             holiday_type AS "holidayType",
             is_optional AS "isOptional",
             description,
             status,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM holidays
      WHERE ${conditions.join(' AND ')}
      ORDER BY holiday_date ASC;
    `;
    const res = await pool.query(sql, values);
    return res.rows;
  },

  /**
   * Find a single holiday by ID
   */
  async findById(id, orgId) {
    const sql = `
      SELECT id, org_id AS "orgId", name, 
             TO_CHAR(holiday_date, 'YYYY-MM-DD') AS "holidayDate",
             holiday_type AS "holidayType",
             is_optional AS "isOptional",
             description,
             status,
             created_at AS "createdAt",
             updated_at AS "updatedAt"
      FROM holidays
      WHERE id = $1 AND org_id = $2
      LIMIT 1;
    `;
    const res = await pool.query(sql, [id, orgId]);
    return res.rows[0] || null;
  },

  /**
   * Find by specific date
   */
  async findByDate(orgId, holidayDate) {
    const sql = `
      SELECT id, org_id AS "orgId", name, 
             TO_CHAR(holiday_date, 'YYYY-MM-DD') AS "holidayDate",
             holiday_type AS "holidayType",
             is_optional AS "isOptional",
             description,
             status
      FROM holidays
      WHERE org_id = $1 AND holiday_date = $2::date
      LIMIT 1;
    `;
    const res = await pool.query(sql, [orgId, holidayDate]);
    return res.rows[0] || null;
  },

  /**
   * Declare / upsert a company holiday on a specific date
   */
  async upsertHoliday({ orgId, name, holidayDate, holidayType = 'COMPANY', isOptional = false, description = '', status = 'Active' }) {
    const id = `hol-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sql = `
      INSERT INTO holidays (id, org_id, name, holiday_date, holiday_type, is_optional, description, status, created_at, updated_at)
      VALUES ($1, $2, $3, $4::date, $5, $6, $7, $8, NOW(), NOW())
      ON CONFLICT (org_id, holiday_date)
      DO UPDATE SET
        name = EXCLUDED.name,
        holiday_type = EXCLUDED.holiday_type,
        is_optional = EXCLUDED.is_optional,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        updated_at = NOW()
      RETURNING id, org_id AS "orgId", name, 
                TO_CHAR(holiday_date, 'YYYY-MM-DD') AS "holidayDate",
                holiday_type AS "holidayType",
                is_optional AS "isOptional",
                description,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt";
    `;
    const values = [id, orgId, name, holidayDate, holidayType, isOptional, description, status];
    const res = await pool.query(sql, values);
    return res.rows[0];
  },

  /**
   * Update existing holiday
   */
  async updateHoliday(id, orgId, fields = {}) {
    const updates = [];
    const values = [id, orgId];
    let idx = 3;

    if (fields.name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(fields.name);
    }
    if (fields.holidayDate !== undefined) {
      updates.push(`holiday_date = $${idx++}::date`);
      values.push(fields.holidayDate);
    }
    if (fields.holidayType !== undefined) {
      updates.push(`holiday_type = $${idx++}`);
      values.push(fields.holidayType);
    }
    if (fields.isOptional !== undefined) {
      updates.push(`is_optional = $${idx++}`);
      values.push(Boolean(fields.isOptional));
    }
    if (fields.description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(fields.description);
    }
    if (fields.status !== undefined) {
      updates.push(`status = $${idx++}`);
      values.push(fields.status);
    }

    if (updates.length === 0) {
      return this.findById(id, orgId);
    }

    updates.push(`updated_at = NOW()`);

    const sql = `
      UPDATE holidays
      SET ${updates.join(', ')}
      WHERE id = $1 AND org_id = $2
      RETURNING id, org_id AS "orgId", name, 
                TO_CHAR(holiday_date, 'YYYY-MM-DD') AS "holidayDate",
                holiday_type AS "holidayType",
                is_optional AS "isOptional",
                description,
                status,
                created_at AS "createdAt",
                updated_at AS "updatedAt";
    `;
    const res = await pool.query(sql, values);
    return res.rows[0] || null;
  },

  /**
   * Delete holiday by ID
   */
  async delete(id, orgId) {
    const res = await pool.query('DELETE FROM holidays WHERE id = $1 AND org_id = $2;', [id, orgId]);
    return res.rowCount > 0;
  }
};

