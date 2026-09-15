import { sendError } from '../utils/apiResponse.js';

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

    // SuperAdmin has full system access bypass
    if (req.user.roleName === 'SuperAdmin') {
      return next();
    }

    const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
    const userPermissions = req.user.permissions || [];

    const hasPermission = permissions.some((perm) => userPermissions.includes(perm));

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

    if (req.user.roleName === 'SuperAdmin' || allowedRoles.includes(req.user.roleName)) {
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
