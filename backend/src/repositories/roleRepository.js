import { roles, permissions } from './dataStore.js';

export const roleRepository = {
  async findAllRoles() {
    return [...roles];
  },

  async findRoleById(id) {
    return roles.find((r) => r.id === id) || null;
  },

  async findRoleByName(name) {
    return roles.find((r) => r.name.toLowerCase() === name.toLowerCase()) || null;
  },

  async findAllPermissions() {
    return [...permissions];
  },
};
