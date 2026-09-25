import { query } from '../config/db.js';

/**
 * Checks whether an employee object or employee database record represents the CEO or Admin.
 * Identifies the CEO/Admin via existing role structure ('Admin', 'SuperAdmin', 'OrgAdmin')
 * or CEO designation ('desig-ceo', title 'CEO', code 'CEO') WITHOUT hardcoding personal names.
 *
 * @param {Object} emp - Employee domain object or row
 * @returns {boolean}
 */
export const isCeoOrAdmin = (emp) => {
  if (!emp) return false;

  // 1. Role check (direct or nested)
  const role = (
    emp.user?.roleName ||
    emp.roleName ||
    emp.role_name ||
    emp.role?.name ||
    (typeof emp.role === 'string' ? emp.role : '') ||
    ''
  ).toLowerCase().trim();

  if (['admin', 'superadmin', 'orgadmin'].some((r) => role.includes(r))) {
    return true;
  }

  // 2. Designation check (ID, Code, Title)
  const desigId = emp.desigId || emp.desig_id || emp.designation?.id;
  if (desigId === 'desig-ceo') {
    return true;
  }

  const desigCode = (
    emp.designationCode ||
    emp.designation?.code ||
    emp.desigCode ||
    emp.desig_code ||
    ''
  ).toUpperCase().trim();
  if (desigCode === 'CEO') {
    return true;
  }

  const desigTitle = (
    emp.designationTitle ||
    emp.designation?.title ||
    emp.designationName ||
    emp.designation_title ||
    (typeof emp.designation === 'string' ? emp.designation : '') ||
    ''
  ).toLowerCase().trim();
  if (desigTitle === 'ceo' || desigTitle.includes('chief executive officer')) {
    return true;
  }

  // 3. Department check
  const deptCode = (emp.department?.code || emp.dept_code || '').toUpperCase().trim();
  const deptId = emp.deptId || emp.dept_id;
  if ((deptId === 'dept-main' || deptCode === 'MAIN') && (desigTitle === 'ceo' || desigId === 'desig-ceo')) {
    return true;
  }

  return false;
};

/**
 * Database-level verification to check if an employee ID belongs to the CEO or an Admin.
 *
 * @param {string} employeeId
 * @param {string} [orgId]
 * @returns {Promise<boolean>}
 */
export const checkIsEmployeeCeoOrAdmin = async (employeeId, orgId = null) => {
  if (!employeeId) return false;

  try {
    const sql = `
      SELECT e.id, e.desig_id, e.dept_id,
             r.name AS role_name,
             ds.title AS desig_title, ds.code AS desig_code
      FROM employees e
      LEFT JOIN users u ON u.id = e.user_id
      LEFT JOIN roles r ON r.id = u.role_id
      LEFT JOIN designations ds ON ds.id = e.desig_id
      WHERE e.id = $1 ${orgId ? 'AND e.org_id = $2' : ''}
      LIMIT 1;
    `;
    const params = orgId ? [employeeId, orgId] : [employeeId];
    const res = await query(sql, params);
    if (res.rows.length === 0) return false;

    const row = res.rows[0];
    const roleName = (row.role_name || '').toLowerCase().trim();
    if (['admin', 'superadmin', 'orgadmin'].some((r) => roleName.includes(r))) return true;
    if (row.desig_id === 'desig-ceo') return true;
    if ((row.desig_code || '').toUpperCase().trim() === 'CEO') return true;
    if ((row.desig_title || '').toLowerCase().trim() === 'ceo') return true;

    return false;
  } catch (err) {
    console.warn('checkIsEmployeeCeoOrAdmin error:', err.message);
    return false;
  }
};
