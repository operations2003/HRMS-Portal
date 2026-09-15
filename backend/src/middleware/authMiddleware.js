import { verifyToken } from '../utils/tokenUtils.js';
import { userRepository } from '../repositories/userRepository.js';
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

    // Verify user still exists in the system
    const user = await userRepository.findById(decoded.id);
    if (!user || user.status === 'Inactive') {
      return sendError(res, 'User account not found or deactivated.', 401, ['Inactive or deleted account']);
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
    };

    next();
  } catch (error) {
    next(error);
  }
};
