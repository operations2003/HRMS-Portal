import { pool } from '../config/db.js';

/**
 * Format a joined employee row into the standard API response structure
 */
const mapEmployeeRow = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    orgId: row.orgId,
    deptId: row.deptId || null,
    desigId: row.desigId || null,
    userId: row.userId || null,
    employeeCode: row.employeeCode,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    phone: row.phone || '',
    dateOfJoining: row.dateOfJoining || '',
    employmentType: row.employmentType || 'Full-Time',
    status: row.status || 'Active',
    salary: parseFloat(row.salary) || 0,
    shiftTiming: row.shiftTiming || '11:00 AM - 07:00 PM',
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    organization: row.o_id ? { id: row.o_id, name: row.o_name, code: row.o_code } : null,
    department: row.d_id ? { id: row.d_id, name: row.d_name, code: row.d_code } : null,
    designation: row.ds_id ? { id: row.ds_id, title: row.ds_title, code: row.ds_code } : null,
    user: row.u_id ? { id: row.u_id, status: row.u_status, roleId: row.r_id, roleName: row.r_name } : null,
  };
};

const BASE_EMPLOYEE_SELECT = `
  SELECT 
    e.id,
    e.org_id AS "orgId",
    e.dept_id AS "deptId",
    e.desig_id AS "desigId",
    e.user_id AS "userId",
    e.employee_code AS "employeeCode",
    e.first_name AS "firstName",
    e.last_name AS "lastName",
    e.email,
    e.phone,
    TO_CHAR(e.date_of_joining, 'YYYY-MM-DD') AS "dateOfJoining",
    e.employment_type AS "employmentType",
    e.status,
    e.salary::float AS salary,
    e.shift_timing AS "shiftTiming",
    e.created_at AS "createdAt",
    e.updated_at AS "updatedAt",
    o.id AS "o_id", o.name AS "o_name", o.code AS "o_code",
    d.id AS "d_id", d.name AS "d_name", d.code AS "d_code",
    ds.id AS "ds_id", ds.title AS "ds_title", ds.code AS "ds_code",
    u.id AS "u_id", u.status AS "u_status",
    r.id AS "r_id", r.name AS "r_name"
  FROM employees e
  LEFT JOIN organizations o ON o.id = e.org_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN designations ds ON ds.id = e.desig_id
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN roles r ON r.id = u.role_id
`;

export const employeeRepository = {
  /**
   * Find all employees with filtering and pagination
   */
  async findAll({ search = '', orgId = '', deptId = '', status = '', page = 1, limit = 20 } = {}) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (orgId) {
      conditions.push(`e.org_id = $${paramIndex++}`);
      values.push(orgId);
    }

    if (deptId) {
      conditions.push(`e.dept_id = $${paramIndex++}`);
      values.push(deptId);
    }

    if (status) {
      conditions.push(`LOWER(e.status) = LOWER($${paramIndex++})`);
      values.push(status);
    }

    if (search) {
      const q = `%${search.toLowerCase()}%`;
      conditions.push(
        `(LOWER(e.first_name) LIKE $${paramIndex} OR LOWER(e.last_name) LIKE $${paramIndex} OR LOWER(e.email) LIKE $${paramIndex} OR LOWER(e.employee_code) LIKE $${paramIndex})`
      );
      values.push(q);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countSql = `SELECT COUNT(*)::int AS total FROM employees e ${whereClause};`;
    const countRes = await pool.query(countSql, values);
    const total = countRes.rows[0]?.total || 0;

    // Pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.max(1, parseInt(limit, 10) || 20);
    const offset = (pageNum - 1) * limitNum;

    const listSql = `
      ${BASE_EMPLOYEE_SELECT}
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++};
    `;

    const listRes = await pool.query(listSql, [...values, limitNum, offset]);
    const employees = listRes.rows.map(mapEmployeeRow);

    return {
      employees,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum) || 1,
      },
    };
  },

  /**
   * Find employee by ID
   */
  async findById(id) {
    if (!id || typeof id !== 'string') return null;

    const sql = `
      ${BASE_EMPLOYEE_SELECT}
      WHERE e.id = $1;
    `;
    const res = await pool.query(sql, [id]);
    return res.rows.length > 0 ? mapEmployeeRow(res.rows[0]) : null;
  },

  /**
   * Find employee by linked user ID and optional org ID
   */
  async findByUserId(userId, orgId = null) {
    if (!userId || typeof userId !== 'string') return null;

    let sql = `${BASE_EMPLOYEE_SELECT} WHERE e.user_id = $1`;
    const values = [userId];

    if (orgId) {
      sql += ' AND e.org_id = $2';
      values.push(orgId);
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapEmployeeRow(res.rows[0]) : null;
  },

  /**
   * Find employee by unique code
   */
  async findByCode(code, orgId = null) {
    if (!code || typeof code !== 'string') return null;

    let sql = `${BASE_EMPLOYEE_SELECT} WHERE UPPER(e.employee_code) = UPPER($1)`;
    const values = [code.trim()];

    if (orgId) {
      sql += ' AND e.org_id = $2';
      values.push(orgId);
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapEmployeeRow(res.rows[0]) : null;
  },

  /**
   * Find employee by email
   */
  async findByEmail(email, orgId = null) {
    if (!email || typeof email !== 'string') return null;

    let sql = `${BASE_EMPLOYEE_SELECT} WHERE LOWER(e.email) = LOWER($1)`;
    const values = [email.trim()];

    if (orgId) {
      sql += ' AND e.org_id = $2';
      values.push(orgId);
    }

    sql += ' LIMIT 1;';
    const res = await pool.query(sql, values);
    return res.rows.length > 0 ? mapEmployeeRow(res.rows[0]) : null;
  },

  /**
   * Create new employee record in PostgreSQL
   */
  async create(data) {
    const id = data.id || `emp-${Date.now()}`;
    const orgId = data.orgId;
    const deptId = data.deptId || null;
    const desigId = data.desigId || null;
    const userId = data.userId || null;
    const employeeCode = data.employeeCode ? data.employeeCode.trim() : `EMP-${Math.floor(100 + Math.random() * 900)}`;
    const firstName = data.firstName.trim();
    const lastName = data.lastName.trim();
    const email = data.email.trim().toLowerCase();
    const phone = data.phone ? data.phone.trim() : '';
    const dateOfJoining = data.dateOfJoining || new Date().toISOString().split('T')[0];
    const employmentType = data.employmentType || 'Full-Time';
    const status = data.status || 'Active';
    const salary = data.salary ? Number(data.salary) : 0;
    const shiftTiming = data.shiftTiming ? data.shiftTiming.trim() : '11:00 AM - 07:00 PM';

    const sql = `
      INSERT INTO employees (
        id, org_id, dept_id, desig_id, user_id, employee_code,
        first_name, last_name, email, phone, date_of_joining,
        employment_type, status, salary, shift_timing
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      RETURNING id;
    `;

    await pool.query(sql, [
      id,
      orgId,
      deptId,
      desigId,
      userId,
      employeeCode,
      firstName,
      lastName,
      email,
      phone,
      dateOfJoining,
      employmentType,
      status,
      salary,
      shiftTiming,
    ]);

    return this.findById(id);
  },

  /**
   * Update existing employee record
   */
  async update(id, data) {
    if (!id || typeof id !== 'string') return null;

    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    if (data.firstName !== undefined) {
      setClauses.push(`first_name = $${paramIndex++}`);
      values.push(data.firstName.trim());
    }

    if (data.lastName !== undefined) {
      setClauses.push(`last_name = $${paramIndex++}`);
      values.push(data.lastName.trim());
    }

    if (data.email !== undefined) {
      setClauses.push(`email = $${paramIndex++}`);
      values.push(data.email.trim().toLowerCase());
    }

    if (data.phone !== undefined) {
      setClauses.push(`phone = $${paramIndex++}`);
      values.push(data.phone.trim());
    }

    if (data.orgId !== undefined) {
      setClauses.push(`org_id = $${paramIndex++}`);
      values.push(data.orgId);
    }

    if (data.deptId !== undefined) {
      setClauses.push(`dept_id = $${paramIndex++}`);
      values.push(data.deptId || null);
    }

    if (data.desigId !== undefined) {
      setClauses.push(`desig_id = $${paramIndex++}`);
      values.push(data.desigId || null);
    }

    if (data.userId !== undefined) {
      setClauses.push(`user_id = $${paramIndex++}`);
      values.push(data.userId || null);
    }

    if (data.employeeCode !== undefined) {
      setClauses.push(`employee_code = $${paramIndex++}`);
      values.push(data.employeeCode.trim());
    }

    if (data.dateOfJoining !== undefined) {
      setClauses.push(`date_of_joining = $${paramIndex++}`);
      values.push(data.dateOfJoining);
    }

    if (data.employmentType !== undefined) {
      setClauses.push(`employment_type = $${paramIndex++}`);
      values.push(data.employmentType);
    }

    if (data.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    if (data.salary !== undefined) {
      setClauses.push(`salary = $${paramIndex++}`);
      values.push(Number(data.salary) || 0);
    }

    if (data.shiftTiming !== undefined) {
      setClauses.push(`shift_timing = $${paramIndex++}`);
      values.push(data.shiftTiming ? data.shiftTiming.trim() : '11:00 AM - 07:00 PM');
    }

    if (setClauses.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const sql = `
      UPDATE employees
      SET ${setClauses.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id;
    `;

    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;

    return this.findById(id);
  },

  /**
   * Delete an employee
   */
  async delete(id) {
    if (!id || typeof id !== 'string') return false;

    const res = await pool.query('DELETE FROM employees WHERE id = $1;', [id]);
    return res.rowCount > 0;
  },

  /**
   * Load metadata (organizations, departments, designations) directly from PostgreSQL
   */
  async getMetadata() {
    const [orgsRes, deptsRes, desigsRes, rolesRes] = await Promise.all([
      pool.query("SELECT id, name, code FROM organizations WHERE status = 'Active' ORDER BY name ASC;"),
      pool.query('SELECT id, org_id AS "orgId", name, code, description FROM departments WHERE status = \'Active\' ORDER BY name ASC;'),
      pool.query("SELECT id, org_id AS \"orgId\", title, code FROM designations WHERE status = 'Active' ORDER BY title ASC;"),
      pool.query("SELECT id, name, description FROM roles WHERE status = 'Active' ORDER BY name ASC;"),
    ]);

    return {
      organizations: orgsRes.rows,
      departments: deptsRes.rows,
      designations: desigsRes.rows,
      roles: rolesRes.rows,
    };
  },
};
