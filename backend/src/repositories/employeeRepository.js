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
    personalEmail: row.personalEmail || row.personal_email || '',
    phone: row.phone || '',
    dateOfJoining: row.dateOfJoining || '',
    employmentType: row.employmentType || 'Full-Time',
    status: row.status || 'Active',
    salary: parseFloat(row.salary) || 0,
    salaryStructure: row.salaryStructure || null,
    shiftTiming: row.shiftTiming || '11:00 AM - 07:00 PM',
    gender: row.gender || 'Male',
    fatherName: row.fatherName || '',
    motherName: row.motherName || '',
    emergencyContact: row.emergencyContact || '',
    address: row.address || '',
    bankName: row.bankName || '',
    bankAccountNumber: row.bankAccountNumber || '',
    bankIfsc: row.bankIfsc || '',
    bankBranch: row.bankBranch || '',
    uanNumber: row.uanNumber || '',
    avatarUrl: row.avatarUrl || null,
    createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : new Date().toISOString(),
    organization: row.o_id ? { id: row.o_id, name: row.o_name, code: row.o_code } : null,
    department: row.d_id ? { id: row.d_id, name: row.d_name, code: row.d_code } : null,
    designation: row.ds_id ? { id: row.ds_id, title: row.ds_title, code: row.ds_code } : null,
    user: row.u_id ? { id: row.u_id, status: row.u_status, roleId: row.r_id, roleName: row.r_name } : null,
    managerId: row.managerId || null,
    manager: row.m_id
      ? {
          id: row.m_id,
          employeeCode: row.m_code,
          fullName: `${row.m_first_name || ''} ${row.m_last_name || ''}`.trim(),
          email: row.m_email,
          avatarUrl: row.m_avatar_url || null,
        }
      : null,
    hrId: row.hrId || null,
    hr: row.h_id
      ? {
          id: row.h_id,
          employeeCode: row.h_code,
          fullName: `${row.h_first_name || ''} ${row.h_last_name || ''}`.trim(),
          email: row.h_email,
          avatarUrl: row.h_avatar_url || null,
        }
      : null,
    probationStatus: row.probationStatus || 'IN_PROBATION',
    probationStartDate: row.probationStartDate || row.dateOfJoining || null,
    probationEndDate: row.probationEndDate || null,
    probationNotes: row.probationNotes || '',
  };
};

const BASE_EMPLOYEE_SELECT = `
  SELECT 
    e.id,
    e.org_id AS "orgId",
    e.dept_id AS "deptId",
    e.desig_id AS "desigId",
    e.user_id AS "userId",
    e.manager_id AS "managerId",
    e.hr_id AS "hrId",
    e.employee_code AS "employeeCode",
    e.first_name AS "firstName",
    e.last_name AS "lastName",
    e.email,
    e.personal_email AS "personalEmail",
    e.phone,
    e.gender,
    TO_CHAR(e.date_of_joining, 'YYYY-MM-DD') AS "dateOfJoining",
    e.employment_type AS "employmentType",
    e.status,
    e.salary::float AS salary,
    e.salary_structure AS "salaryStructure",
    e.shift_timing AS "shiftTiming",
    e.father_name AS "fatherName",
    e.mother_name AS "motherName",
    e.emergency_contact AS "emergencyContact",
    e.address,
    e.bank_name AS "bankName",
    e.bank_account_number AS "bankAccountNumber",
    e.bank_ifsc AS "bankIfsc",
    e.bank_branch AS "bankBranch",
    e.uan_number AS "uanNumber",
    e.probation_status AS "probationStatus",
    TO_CHAR(e.probation_start_date, 'YYYY-MM-DD') AS "probationStartDate",
    TO_CHAR(e.probation_end_date, 'YYYY-MM-DD') AS "probationEndDate",
    e.probation_notes AS "probationNotes",
    COALESCE(e.avatar_url, u.avatar_url) AS "avatarUrl",
    e.created_at AS "createdAt",
    e.updated_at AS "updatedAt",
    o.id AS "o_id", o.name AS "o_name", o.code AS "o_code",
    d.id AS "d_id", d.name AS "d_name", d.code AS "d_code",
    ds.id AS "ds_id", ds.title AS "ds_title", ds.code AS "ds_code",
    u.id AS "u_id", u.status AS "u_status",
    r.id AS "r_id", r.name AS "r_name",
    m.id AS "m_id", m.employee_code AS "m_code", m.first_name AS "m_first_name", m.last_name AS "m_last_name", m.email AS "m_email", m.avatar_url AS "m_avatar_url",
    h.id AS "h_id", h.employee_code AS "h_code", h.first_name AS "h_first_name", h.last_name AS "h_last_name", h.email AS "h_email", h.avatar_url AS "h_avatar_url"
  FROM employees e
  LEFT JOIN organizations o ON o.id = e.org_id
  LEFT JOIN departments d ON d.id = e.dept_id
  LEFT JOIN designations ds ON ds.id = e.desig_id
  LEFT JOIN users u ON u.id = e.user_id
  LEFT JOIN roles r ON r.id = u.role_id
  LEFT JOIN employees m ON m.id = e.manager_id
  LEFT JOIN employees h ON h.id = e.hr_id
`;

export const employeeRepository = {
  /**
   * Find all employees with filtering and pagination
   */
  async findAll({ search = '', orgId = '', deptId = '', status = '', managerId = '', hrId = '', page = 1, limit = 20 } = {}) {
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

    if (managerId) {
      conditions.push(`e.manager_id = $${paramIndex++}`);
      values.push(managerId);
    }

    if (hrId) {
      conditions.push(`e.hr_id = $${paramIndex++}`);
      values.push(hrId);
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

    try {
      sql += ' LIMIT 1;';
      const res = await pool.query(sql, values);
      return res.rows.length > 0 ? mapEmployeeRow(res.rows[0]) : null;
    } catch (err) {
      console.warn('Database findByUserId query failed:', err.message);
      return null;
    }
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
    const personalEmail = data.personalEmail ? data.personalEmail.trim().toLowerCase() : (data.personal_email ? data.personal_email.trim().toLowerCase() : null);
    const phone = data.phone ? data.phone.trim() : '';
    const dateOfJoining = data.dateOfJoining || new Date().toISOString().split('T')[0];
    const employmentType = data.employmentType || 'Full-Time';
    const status = data.status || 'Active';
    const salary = data.salary ? Number(data.salary) : 0;
    const shiftTiming = data.shiftTiming ? data.shiftTiming.trim() : '11:00 AM - 07:00 PM';
    const gender = data.gender ? data.gender.trim() : 'Male';
    const managerId = data.managerId || null;
    const hrId = data.hrId || null;
    const fatherName = data.fatherName ? data.fatherName.trim() : '';
    const motherName = data.motherName ? data.motherName.trim() : '';
    const emergencyContact = data.emergencyContact ? data.emergencyContact.trim() : '';
    const address = data.address ? data.address.trim() : '';
    const bankName = data.bankName ? data.bankName.trim() : '';
    const bankAccountNumber = data.bankAccountNumber ? data.bankAccountNumber.trim() : '';
    const bankIfsc = data.bankIfsc ? data.bankIfsc.trim() : '';
    const bankBranch = data.bankBranch ? data.bankBranch.trim() : '';
    const uanNumber = data.uanNumber ? data.uanNumber.trim() : '';

    const probationStatus = data.probationStatus || 'IN_PROBATION';
    const probationStartDate = data.probationStartDate || dateOfJoining;
    let probationEndDate = data.probationEndDate;
    if (!probationEndDate && probationStartDate) {
      const pDate = new Date(probationStartDate);
      pDate.setMonth(pDate.getMonth() + 6);
      probationEndDate = pDate.toISOString().split('T')[0];
    }
    const probationNotes = data.probationNotes ? data.probationNotes.trim() : 'Standard 6-month probation period.';

    const sql = `
      INSERT INTO employees (
        id, org_id, dept_id, desig_id, user_id, employee_code,
        first_name, last_name, email, personal_email, phone, date_of_joining,
        employment_type, status, salary, shift_timing, gender, manager_id, hr_id,
        father_name, mother_name, emergency_contact, address,
        bank_name, bank_account_number, bank_ifsc, bank_branch, uan_number,
        probation_status, probation_start_date, probation_end_date, probation_notes,
        salary_structure
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33)
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
      personalEmail,
      phone,
      dateOfJoining,
      employmentType,
      status,
      salary,
      shiftTiming,
      gender,
      managerId,
      hrId,
      fatherName,
      motherName,
      emergencyContact,
      address,
      bankName,
      bankAccountNumber,
      bankIfsc,
      bankBranch,
      uanNumber,
      probationStatus,
      probationStartDate,
      probationEndDate,
      probationNotes,
      data.salaryStructure ? (typeof data.salaryStructure === 'string' ? data.salaryStructure : JSON.stringify(data.salaryStructure)) : null,
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

    if (data.personalEmail !== undefined || data.personal_email !== undefined) {
      const pEmail = data.personalEmail !== undefined ? data.personalEmail : data.personal_email;
      setClauses.push(`personal_email = $${paramIndex++}`);
      values.push(pEmail ? pEmail.trim().toLowerCase() : null);
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

    if (data.salaryStructure !== undefined) {
      setClauses.push(`salary_structure = $${paramIndex++}`);
      values.push(data.salaryStructure ? (typeof data.salaryStructure === 'string' ? data.salaryStructure : JSON.stringify(data.salaryStructure)) : null);
    }

    if (data.shiftTiming !== undefined) {
      setClauses.push(`shift_timing = $${paramIndex++}`);
      values.push(data.shiftTiming ? data.shiftTiming.trim() : '11:00 AM - 07:00 PM');
    }

    if (data.gender !== undefined) {
      setClauses.push(`gender = $${paramIndex++}`);
      values.push(data.gender ? data.gender.trim() : 'Male');
    }

    if (data.managerId !== undefined) {
      setClauses.push(`manager_id = $${paramIndex++}`);
      values.push(data.managerId || null);
    }

    if (data.hrId !== undefined) {
      setClauses.push(`hr_id = $${paramIndex++}`);
      values.push(data.hrId || null);
    }

    if (data.fatherName !== undefined) {
      setClauses.push(`father_name = $${paramIndex++}`);
      values.push(data.fatherName ? data.fatherName.trim() : '');
    }

    if (data.avatarUrl !== undefined || data.avatar_url !== undefined) {
      setClauses.push(`avatar_url = $${paramIndex++}`);
      values.push(data.avatarUrl ?? data.avatar_url ?? null);
    }

    if (data.motherName !== undefined) {
      setClauses.push(`mother_name = $${paramIndex++}`);
      values.push(data.motherName ? data.motherName.trim() : '');
    }

    if (data.emergencyContact !== undefined) {
      setClauses.push(`emergency_contact = $${paramIndex++}`);
      values.push(data.emergencyContact ? data.emergencyContact.trim() : '');
    }

    if (data.address !== undefined) {
      setClauses.push(`address = $${paramIndex++}`);
      values.push(data.address ? data.address.trim() : '');
    }

    if (data.bankName !== undefined) {
      setClauses.push(`bank_name = $${paramIndex++}`);
      values.push(data.bankName ? data.bankName.trim() : '');
    }

    if (data.bankAccountNumber !== undefined) {
      setClauses.push(`bank_account_number = $${paramIndex++}`);
      values.push(data.bankAccountNumber ? data.bankAccountNumber.trim() : '');
    }

    if (data.bankIfsc !== undefined) {
      setClauses.push(`bank_ifsc = $${paramIndex++}`);
      values.push(data.bankIfsc ? data.bankIfsc.trim() : '');
    }

    if (data.bankBranch !== undefined) {
      setClauses.push(`bank_branch = $${paramIndex++}`);
      values.push(data.bankBranch ? data.bankBranch.trim() : '');
    }

    if (data.uanNumber !== undefined) {
      setClauses.push(`uan_number = $${paramIndex++}`);
      values.push(data.uanNumber ? data.uanNumber.trim() : '');
    }

    if (data.probationStatus !== undefined) {
      setClauses.push(`probation_status = $${paramIndex++}`);
      values.push(data.probationStatus);
    }

    if (data.probationStartDate !== undefined) {
      setClauses.push(`probation_start_date = $${paramIndex++}`);
      values.push(data.probationStartDate || null);
    }

    if (data.probationEndDate !== undefined) {
      setClauses.push(`probation_end_date = $${paramIndex++}`);
      values.push(data.probationEndDate || null);
    }

    if (data.probationNotes !== undefined) {
      setClauses.push(`probation_notes = $${paramIndex++}`);
      values.push(data.probationNotes ? data.probationNotes.trim() : null);
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
   * Find direct reports belonging to a manager
   */
  async findDirectReports(managerId, orgId = null) {
    if (!managerId) return [];
    let sql = `${BASE_EMPLOYEE_SELECT} WHERE e.manager_id = $1`;
    const values = [managerId];
    if (orgId) {
      sql += ' AND e.org_id = $2';
      values.push(orgId);
    }
    sql += ' ORDER BY e.first_name ASC, e.last_name ASC;';
    const res = await pool.query(sql, values);
    return res.rows.map(mapEmployeeRow);
  },

  /**
   * Assign or reassign an employee's reporting manager
   */
  async assignManager(employeeId, managerId) {
    const res = await pool.query(
      'UPDATE employees SET manager_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id;',
      [managerId || null, employeeId]
    );
    if (res.rows.length === 0) return null;
    return this.findById(employeeId);
  },

  /**
   * Assign or reassign an employee's assigned HR partner
   */
  async assignHr(employeeId, hrId) {
    const res = await pool.query(
      'UPDATE employees SET hr_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id;',
      [hrId || null, employeeId]
    );
    if (res.rows.length === 0) return null;
    return this.findById(employeeId);
  },

  /**
   * Assign or update both manager and HR hierarchy
   */
  async assignHierarchy(employeeId, { managerId, hrId }) {
    const setClauses = ['updated_at = NOW()'];
    const values = [];
    let idx = 1;

    if (managerId !== undefined) {
      setClauses.push(`manager_id = $${idx++}`);
      values.push(managerId || null);
    }

    if (hrId !== undefined) {
      setClauses.push(`hr_id = $${idx++}`);
      values.push(hrId || null);
    }

    values.push(employeeId);
    const sql = `UPDATE employees SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id;`;
    const res = await pool.query(sql, values);
    if (res.rows.length === 0) return null;
    return this.findById(employeeId);
  },

  /**
   * Get team headcount summary for a manager
   */
  async getTeamSummary(managerId, orgId = null) {
    if (!managerId) return { totalReports: 0, activeCount: 0, onLeaveCount: 0 };
    let sql = `
      SELECT 
        COUNT(*)::int AS "totalReports",
        COUNT(*) FILTER (WHERE LOWER(status) = 'active')::int AS "activeCount",
        COUNT(*) FILTER (WHERE LOWER(status) = 'on leave')::int AS "onLeaveCount"
      FROM employees
      WHERE manager_id = $1
    `;
    const values = [managerId];
    if (orgId) {
      sql += ' AND org_id = $2';
      values.push(orgId);
    }
    const res = await pool.query(sql, values);
    return res.rows[0] || { totalReports: 0, activeCount: 0, onLeaveCount: 0 };
  },

  /**
   * Load metadata (organizations, departments, designations, roles, and eligible managers/HRs)
   */
  async getMetadata() {
    const [orgsRes, deptsRes, desigsRes, rolesRes, empsRes] = await Promise.all([
      pool.query("SELECT id, name, code FROM organizations WHERE status = 'Active' ORDER BY name ASC;"),
      pool.query('SELECT id, org_id AS "orgId", name, code, description FROM departments WHERE status = \'Active\' ORDER BY name ASC;'),
      pool.query("SELECT id, org_id AS \"orgId\", title, code FROM designations WHERE status = 'Active' ORDER BY title ASC;"),
      pool.query("SELECT id, name, description FROM roles WHERE status = 'Active' ORDER BY name ASC;"),
      pool.query(`
        SELECT 
          e.id, 
          e.org_id AS "orgId",
          e.employee_code AS "employeeCode", 
          e.first_name AS "firstName", 
          e.last_name AS "lastName",
          TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS "fullName",
          e.email,
          COALESCE(e.avatar_url, u.avatar_url) AS "avatarUrl",
          d.name AS "departmentName",
          ds.title AS "designationTitle",
          r.name AS "roleName"
        FROM employees e
        LEFT JOIN departments d ON d.id = e.dept_id
        LEFT JOIN designations ds ON ds.id = e.desig_id
        LEFT JOIN users u ON u.id = e.user_id
        LEFT JOIN roles r ON r.id = u.role_id
        WHERE e.status = 'Active'
        ORDER BY e.first_name ASC, e.last_name ASC;
      `),
    ]);

    const allEmps = empsRes.rows;
    // HR candidates: employees with role HR/HRManager, or HR designation/dept, or all staff fallback
    const hrCandidates = allEmps.filter((e) => {
      const role = (e.roleName || '').toLowerCase();
      const desig = (e.designationTitle || '').toLowerCase();
      const dept = (e.departmentName || '').toLowerCase();
      return role.includes('hr') || desig.includes('hr') || dept.includes('human resource') || dept.includes('hr');
    });

    return {
      organizations: orgsRes.rows,
      departments: deptsRes.rows,
      designations: desigsRes.rows,
      roles: rolesRes.rows,
      managers: allEmps, // Any active employee can be chosen as manager
      hrs: hrCandidates.length > 0 ? hrCandidates : allEmps, // HR candidates or fallback to all active staff
    };
  },
};
