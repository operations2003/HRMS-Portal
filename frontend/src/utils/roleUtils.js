/**
 * Role & Assignment Utility Functions
 *
 * Enforces business rule:
 * The CEO is represented by the Admin account in the current HRMS.
 * The CEO/Admin MUST NOT appear as an assignable or reviewable person in any
 * workflow where work is assigned or performance is evaluated.
 *
 * They can still appear in informational records, ticket references, etc.
 */

/**
 * Checks whether an employee or user object represents the CEO or Admin.
 * Uses existing role ('Admin', 'SuperAdmin', 'OrgAdmin') and designation structure ('CEO', 'desig-ceo').
 * Never hard-codes personal names or emails.
 *
 * @param {Object} empOrUser - Employee, User, or option object
 * @returns {boolean}
 */
export const isCeoOrAdmin = (empOrUser) => {
  if (!empOrUser) return false;

  // 1. Role check
  const role = (
    empOrUser.roleName ||
    empOrUser.role_name ||
    empOrUser.role?.name ||
    empOrUser.user?.roleName ||
    empOrUser.user?.role?.name ||
    (typeof empOrUser.role === 'string' ? empOrUser.role : '') ||
    ''
  ).toLowerCase().trim();

  if (['admin', 'superadmin', 'orgadmin'].some((r) => role.includes(r))) {
    return true;
  }

  // 2. Designation check (ID, Code, Title)
  const desigId = empOrUser.desigId || empOrUser.desig_id || empOrUser.designation?.id;
  if (desigId === 'desig-ceo') {
    return true;
  }

  const desigCode = (
    empOrUser.designationCode ||
    empOrUser.designation?.code ||
    empOrUser.desigCode ||
    empOrUser.desig_code ||
    ''
  ).toUpperCase().trim();
  if (desigCode === 'CEO') {
    return true;
  }

  const desigTitle = (
    empOrUser.designationTitle ||
    empOrUser.designation?.title ||
    empOrUser.designationName ||
    empOrUser.designation_title ||
    (typeof empOrUser.designation === 'string' ? empOrUser.designation : '') ||
    ''
  ).toLowerCase().trim();
  if (desigTitle === 'ceo' || desigTitle.includes('chief executive officer')) {
    return true;
  }

  // 3. Department check
  const deptCode = (empOrUser.department?.code || empOrUser.dept_code || '').toUpperCase().trim();
  const deptId = empOrUser.deptId || empOrUser.dept_id;
  if ((deptId === 'dept-main' || deptCode === 'MAIN') && (desigTitle === 'ceo' || desigId === 'desig-ceo')) {
    return true;
  }

  return false;
};

/**
 * Filters an array of employee objects to remove the CEO/Admin.
 * Use for:
 * - Work & Task assignment dropdowns
 * - Performance reviewee selection dropdowns
 * - Appraisal creation dropdowns
 *
 * @param {Array} employees
 * @returns {Array}
 */
export const filterNonCeoEmployees = (employees) => {
  if (!Array.isArray(employees)) return [];
  return employees.filter((emp) => !isCeoOrAdmin(emp));
};
