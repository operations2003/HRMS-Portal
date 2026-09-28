import { sendError } from '../utils/apiResponse.js';

/**
 * Normalizes role string for comparison
 */
const normalizeRole = (r) => (r || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Role-Based Access Control (RBAC) Middleware
 * Checks whether authenticated user has at least one of the required permissions
 * @param {string|string[]} requiredPermissions - Single permission code or array of permitted codes
 */
export const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized. Please authenticate first.', 401);
    }

    const normRole = normalizeRole(req.user.roleName);
    // SuperAdmin, Admin, or OrgAdmin has full system access bypass
    if (normRole === 'superadmin' || normRole === 'admin' || normRole === 'orgadmin') {
      return next();
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const userPermissions = req.user.permissions || [];

    const hasPermission = permissions.some((perm) => {
      if (userPermissions.includes(perm)) return true;
      if (normalizeRole(req.user.roleName) === normalizeRole(perm)) return true;
      return false;
    });

    if (!hasPermission) {
      return sendError(
        res,
        'Access Forbidden: You do not have permission to perform this action.',
        403,
        [`Requires one of the following permissions: ${permissions.join(', ')}`]
      );
    }

    next();
  };
};

/**
 * Role-based check middleware (alternative or complementary to permissions)
 * @param {string[]} allowedRoles
 */
export const requireRoles = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 'Unauthorized. Please authenticate first.', 401);
    }

    const normUserRole = normalizeRole(req.user.roleName);
    if (normUserRole === 'superadmin' || normUserRole === 'admin' || normUserRole === 'orgadmin') {
      return next();
    }

    const normAllowed = allowedRoles.map(normalizeRole);
    if (normAllowed.includes(normUserRole)) {
      return next();
    }

    return sendError(
      res,
      'Access Forbidden: Your role is not authorized for this resource.',
      403,
      [`Allowed roles: ${allowedRoles.join(', ')}`]
    );
  };
};

/**
 * Checks whether user can manage training programs:
 * ADMIN (Admin, SuperAdmin, OrgAdmin) OR (Role = HR AND Department = Learning & Development)
 */
export const canManageTraining = (user) => {
  if (!user) return false;
  const normRole = normalizeRole(user.roleName);
  if (normRole === 'superadmin' || normRole === 'admin' || normRole === 'orgadmin') {
    return true;
  }

  // Any role with L&D or Training in title
  if (
    normRole.includes('ld') ||
    normRole.includes('l&d') ||
    normRole.includes('learning') ||
    normRole.includes('training') ||
    normRole.includes('trainer')
  ) {
    return true;
  }

  // Any personnel in the Learning & Development department
  const deptName = (user.departmentName || user.department?.name || user.deptName || '').toLowerCase().trim();
  const deptCode = (user.departmentCode || user.department?.code || user.deptCode || '').toLowerCase().trim();
  const deptId = (user.deptId || '').toLowerCase().trim();

  const isLdDept = (
    deptName === 'learning & development' ||
    deptName === 'learning and development' ||
    deptName.includes('learning') ||
    deptName.includes('l&d') ||
    deptCode === 'l&d' ||
    deptCode === 'ld' ||
    deptId === 'dept-ld'
  );

  return isLdDept;
};

/**
 * Middleware ensuring user is ADMIN or from the Learning & Development (L&D) Department
 */
export const authorizeTrainingManager = (req, res, next) => {
  if (!req.user) {
    return sendError(res, 'Unauthorized. Please authenticate first.', 401);
  }

  if (canManageTraining(req.user)) {
    return next();
  }

  return sendError(
    res,
    'Access Forbidden: Only Administrators and personnel in the Learning & Development department can manage and assign training programs.',
    403
  );
};


