import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { hashPassword } from '../utils/passwordUtils.js';

/**
 * Remove sensitive passwordHash from user object before sending response
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const sanitized = { ...user };
  delete sanitized.passwordHash;
  return sanitized;
};

export const userService = {
  async listUsers() {
    const users = await userRepository.findAll();
    return users.map(sanitizeUser);
  },

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      const error = new Error(`User with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return sanitizeUser(user);
  },

  async createUser(data) {
    // 1. Validate role is provided
    if (!data.roleId || typeof data.roleId !== 'string' || !data.roleId.trim()) {
      const error = new Error('Role selection is required.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate role exists
    let role = await roleRepository.findRoleById(data.roleId.trim());
    if (!role) {
      // Also check by name
      role = await roleRepository.findRoleByName(data.roleId.trim());
    }
    if (!role) {
      const error = new Error(`Role '${data.roleId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Validate organization exists
    const orgId = data.orgId || 'org-1';
    const org = await orgRepository.findById(orgId);
    if (!org) {
      const error = new Error(`Organization with ID '${orgId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }

    // 4. Check duplicate email
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      const error = new Error(`A user with email '${data.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    // 5. Secure bcrypt hash
    const passwordHash = await hashPassword(data.password);

    try {
      const newUser = await userRepository.create({
        ...data,
        roleId: role.id,
        orgId,
        passwordHash,
      });
      return sanitizeUser(newUser);
    } catch (dbError) {
      if (dbError.code === '23505') {
        const error = new Error(`A user with email '${data.email}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
      if (dbError.code === '23503') {
        const error = new Error('Invalid role or organization selected.');
        error.statusCode = 400;
        throw error;
      }
      throw dbError;
    }
  },

  async updateUser(id, data) {
    const existing = await userRepository.findById(id);
    if (!existing) {
      const error = new Error(`User with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const updates = { ...data };
    if (data.password) {
      updates.passwordHash = await hashPassword(data.password);
      delete updates.password;
    }

    if (data.roleId) {
      const role = (await roleRepository.findRoleById(data.roleId)) || (await roleRepository.findRoleByName(data.roleId));
      if (!role) {
        const error = new Error(`Role '${data.roleId}' does not exist.`);
        error.statusCode = 400;
        throw error;
      }
      updates.roleId = role.id;
    }

    try {
      const updated = await userRepository.update(id, updates);
      return sanitizeUser(updated);
    } catch (dbError) {
      if (dbError.code === '23505') {
        const error = new Error(`A user with email '${data.email}' already exists.`);
        error.statusCode = 409;
        throw error;
      }
      if (dbError.code === '23503') {
        const error = new Error('Invalid role or organization selected.');
        error.statusCode = 400;
        throw error;
      }
      throw dbError;
    }
  },

  async getRoles() {
    return await roleRepository.findAllRoles();
  },

  async getPermissions() {
    return await roleRepository.findAllPermissions();
  },

  /**
   * Deactivate/disable user account during access deprovisioning
   */
  async deactivateUser(id, reason = 'Account deactivated during deprovisioning') {
    const user = await userRepository.findById(id);
    if (!user) {
      const error = new Error(`User with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    const updated = await userRepository.update(id, { status: 'Inactive' });
    return sanitizeUser(updated);
  },
};
