import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { hashPassword } from '../utils/passwordUtils.js';

export const userService = {
  async listUsers() {
    return await userRepository.findAll();
  },

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      const error = new Error(`User with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return user;
  },

  async createUser(data) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      const error = new Error(`A user with email '${data.email}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    const role = await roleRepository.findRoleById(data.roleId);
    if (!role) {
      const error = new Error(`Role '${data.roleId}' does not exist.`);
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = await hashPassword(data.password);

    return await userRepository.create({
      ...data,
      passwordHash,
    });
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

    return await userRepository.update(id, updates);
  },

  async getRoles() {
    return await roleRepository.findAllRoles();
  },

  async getPermissions() {
    return await roleRepository.findAllPermissions();
  },
};
