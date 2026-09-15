import { userRepository } from '../repositories/userRepository.js';
import { comparePassword } from '../utils/passwordUtils.js';
import { generateToken } from '../utils/tokenUtils.js';

export const authService = {
  /**
   * Authenticate user with email and password
   */
  async login(email, password) {
    const user = await userRepository.findByEmail(email);

    if (!user) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    if (user.status !== 'Active') {
      const error = new Error('Your account is inactive. Please contact your administrator.');
      error.statusCode = 403;
      throw error;
    }

    const isMatch = await comparePassword(password, user.passwordHash);
    if (!isMatch) {
      const error = new Error('Invalid email or password.');
      error.statusCode = 401;
      throw error;
    }

    // Generate JWT token
    const token = generateToken({
      id: user.id,
      email: user.email,
      roleName: user.roleName,
      orgId: user.orgId,
    });

    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        orgId: user.orgId,
        roleId: user.roleId,
        roleName: user.roleName,
        roleDescription: user.roleDescription,
        permissions: user.permissions,
        organization: user.organization,
      },
    };
  },

  /**
   * Get authenticated profile data
   */
  async getProfile(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 404;
      throw error;
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      orgId: user.orgId,
      roleId: user.roleId,
      roleName: user.roleName,
      roleDescription: user.roleDescription,
      permissions: user.permissions,
      organization: user.organization,
    };
  },
};
