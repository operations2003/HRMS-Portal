import { http } from './api.js';

export const adminService = {
  /**
   * List users with administrative filters
   */
  async listUsers(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/admin/users${queryString}`);
    return res.data;
  },

  /**
   * Get single user details
   */
  async getUserById(id) {
    const res = await http.get(`/v1/admin/users/${id}`);
    return res.data;
  },

  /**
   * Create user with system role
   */
  async createUser(data) {
    const res = await http.post('/v1/admin/users', data);
    return res.data;
  },

  /**
   * Update user details
   */
  async updateUser(id, data) {
    const res = await http.put(`/v1/admin/users/${id}`, data);
    return res.data;
  },

  /**
   * Set user status (Active / Inactive / Suspended)
   */
  async setUserStatus(id, { status, reason }) {
    const res = await http.patch(`/v1/admin/users/${id}/status`, { status, reason });
    return res.data;
  },

  /**
   * Assign role to user
   */
  async assignUserRole(id, { roleId, reason }) {
    const res = await http.put(`/v1/admin/users/${id}/role`, { roleId, reason });
    return res.data;
  },

  /**
   * List system roles with permission counts
   */
  async listRoles() {
    const res = await http.get('/v1/admin/roles');
    return res.data;
  },

  /**
   * Get role by ID with permissions
   */
  async getRoleById(id) {
    const res = await http.get(`/v1/admin/roles/${id}`);
    return res.data;
  },

  /**
   * Create new system role
   */
  async createRole(data) {
    const res = await http.post('/v1/admin/roles', data);
    return res.data;
  },

  /**
   * Update existing role
   */
  async updateRole(id, data) {
    const res = await http.put(`/v1/admin/roles/${id}`, data);
    return res.data;
  },

  /**
   * Assign permissions array to a role
   */
  async assignRolePermissions(id, permissions) {
    const res = await http.put(`/v1/admin/roles/${id}/permissions`, { permissions });
    return res.data;
  },

  /**
   * Revoke single permission from role
   */
  async revokeRolePermission(roleId, permissionId) {
    const res = await http.delete(`/v1/admin/roles/${roleId}/permissions/${permissionId}`);
    return res.data;
  },

  /**
   * List all available system permissions
   */
  async listPermissions() {
    const res = await http.get('/v1/admin/permissions');
    return res.data;
  },

  /**
   * Get administrative configurations
   */
  async getConfigurations(category) {
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await http.get(`/v1/admin/configurations${query}`);
    return res.data;
  },

  /**
   * Get single configuration by key
   */
  async getConfigurationByKey(key) {
    const res = await http.get(`/v1/admin/configurations/${encodeURIComponent(key)}`);
    return res.data;
  },

  /**
   * Update or create a system configuration
   */
  async updateConfiguration(data) {
    const res = await http.put('/v1/admin/configurations', data);
    return res.data;
  },

  /**
   * Retrieve system audit logs
   */
  async getAuditLogs(params = {}) {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await http.get(`/v1/admin/audit-logs${queryString}`);
    return res.data;
  },

  /**
   * Get system health and platform telemetry
   */
  async getSystemOverview() {
    const res = await http.get('/v1/admin/overview');
    return res.data;
  },
};
