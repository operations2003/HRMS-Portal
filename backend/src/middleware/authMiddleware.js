import { verifyToken } from '../utils/tokenUtils.js';
import { userRepository } from '../repositories/userRepository.js';
import { employeeRepository } from '../repositories/employeeRepository.js';
import { sendError } from '../utils/apiResponse.js';

/**
 * Authentication Middleware
 * Enforces valid Bearer JWT token on protected routes
 */
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(
        res,
        'Authentication token required. Please log in to continue.',
        401,
        ['Missing or malformed Authorization header.']
      );
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 'Session expired. Please log in again.', 401, ['Token expired']);
      }
      return sendError(res, 'Invalid authentication token.', 401, ['Token verification failed']);
    }

    // 1. Verify user exists and is actively enabled
    const user = await userRepository.findById(decoded.id);
    if (!user || user.status !== 'Active') {
      return sendError(res, 'User account not found, deactivated, or disabled.', 401, [
        'Inactive or disabled account',
      ]);
    }

    // 2. Verify associated employee profile has not been deprovisioned / exited
    const emp = await employeeRepository.findByUserId(user.id, user.orgId);
    const normRole = (user.roleName || '').toLowerCase();
    if (normRole !== 'superadmin') {
      if (emp && (emp.status === 'Exited' || emp.status === 'Terminated' || emp.status === 'Inactive')) {
        return sendError(res, 'Access denied: Your employee account has been deprovisioned.', 401, [
          `Employment status is '${emp.status}'`,
        ]);
      }
    }

    // Attach sanitized user information to request
    req.user = {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      orgId: user.orgId,
      roleId: user.roleId,
      roleName: user.roleName,
      permissions: user.permissions,
      organization: user.organization,
      employeeId: emp ? emp.id : null,
      employeeCode: emp ? emp.employeeCode : null,
      deptId: emp ? emp.deptId : null,
      department: emp?.department || null,
      departmentName: emp?.department?.name || null,
      departmentCode: emp?.department?.code || null,
      managerId: emp ? emp.managerId : null,
    };

    next();
  } catch (error) {
    next(error);
  }
};
