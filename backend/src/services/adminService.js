import { userRepository } from '../repositories/userRepository.js';
import { roleRepository } from '../repositories/roleRepository.js';
import { adminRepository } from '../repositories/adminRepository.js';
import { orgRepository } from '../repositories/orgRepository.js';
import { userService } from './userService.js';
import { hashPassword } from '../utils/passwordUtils.js';

/**
 * Remove sensitive passwordHash from user object
 */
const sanitizeUser = (user) => {
  if (!user) return null;
  const sanitized = { ...user };
  delete sanitized.passwordHash;
  return sanitized;
};

export const adminService = {
  // =========================================================================
  // 1. USER MANAGEMENT & RBAC ASSIGNMENT
  // =========================================================================

  /**
   * List all users with optional filtering by status, role, search query
   */
  async listUsers({ orgId, status, roleId, search }) {
    let users = await userRepository.findAll();

    // Filter by organization if specified
    if (orgId) {
      users = users.filter((u) => u.orgId === orgId);
    }

    // Filter by status
    if (status) {
      users = users.filter((u) => u.status && u.status.toLowerCase() === status.toLowerCase());
    }

    // Filter by roleId
    if (roleId) {
      users = users.filter((u) => u.roleId === roleId);
    }

    // Filter by search query (name, email)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      users = users.filter((u) => {
        const fullName = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
        const email = (u.email || '').toLowerCase();
        return fullName.includes(q) || email.includes(q);
      });
    }

    return users.map(sanitizeUser);
  },

  /**
   * Get single user by ID with roles and permissions
   */
  async getUserById(userId) {
    const user = await userRepository.findById(userId);
    if (!user) {
      const error = new Error(`User with ID '${userId}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return sanitizeUser(user);
  },

  /**
   * Create a new user account with role assignment and audit logging
   */
  async createUser({ actor, userData, ipAddress = null }) {
    // 1. Delegate creation and basic validation to userService
    const newUser = await userService.createUser(userData);

    // 2. Audit log creation
    await adminRepository.recordAuditLog({
      orgId: actor.orgId || userData.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'USER',
      targetId: newUser.id,
      action: 'CREATE_USER',
      previousValue: null,
      newValue: {
        id: newUser.id,
        email: newUser.email,
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        roleId: newUser.roleId,
        roleName: newUser.roleName,
        status: newUser.status,
      },
      reason: userData.reason || 'Admin created new user account',
      ipAddress,
    });

    return newUser;
  },

  /**
   * Update an existing user account with protection against self-escalation
   */
  async updateUser({ actor, userId, updates, ipAddress = null }) {
    // 1. Check user exists
    const existing = await userRepository.findById(userId);
    if (!existing) {
      const error = new Error(`User with ID '${userId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 2. SECURITY GUARD: Self-role modification prevention
    if (actor.id === userId && updates.roleId && updates.roleId !== existing.roleId) {
      const error = new Error('Security Violation: Administrators cannot change their own assigned role. Another administrator must perform this action.');
      error.statusCode = 403;
      throw error;
    }

    // 3. SECURITY GUARD: Self-deactivation prevention
    if (actor.id === userId && updates.status && updates.status.toLowerCase() === 'inactive') {
      const error = new Error('Security Violation: Administrators cannot deactivate their own active account.');
      error.statusCode = 400;
      throw error;
    }

    // 4. Capture previous state for audit log
    const previousValue = {
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      roleId: existing.roleId,
      roleName: existing.roleName,
      status: existing.status,
    };

    // 5. Update user via userService
    const updated = await userService.updateUser(userId, updates);

    // 6. Audit log update
    await adminRepository.recordAuditLog({
      orgId: actor.orgId || existing.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'USER',
      targetId: userId,
      action: 'UPDATE_USER',
      previousValue,
      newValue: {
        firstName: updated.firstName,
        lastName: updated.lastName,
        email: updated.email,
        roleId: updated.roleId,
        roleName: updated.roleName,
        status: updated.status,
      },
      reason: updates.reason || 'Administrative user profile/settings update',
      ipAddress,
    });

    return updated;
  },

  /**
   * Set user active / inactive status
   */
  async setUserStatus({ actor, userId, status, reason = '', ipAddress = null }) {
    const validStatuses = ['Active', 'Inactive', 'Suspended'];
    if (!status || !validStatuses.includes(status)) {
      const error = new Error(`Invalid status '${status}'. Must be one of: ${validStatuses.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }

    // 1. Guard against self-deactivation
    if (actor.id === userId && status !== 'Active') {
      const error = new Error('Security Violation: Administrators cannot deactivate or suspend their own account.');
      error.statusCode = 400;
      throw error;
    }

    // 2. Fetch existing user
    const existing = await userRepository.findById(userId);
    if (!existing) {
      const error = new Error(`User with ID '${userId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // If unchanged, return immediately
    if (existing.status === status) {
      return sanitizeUser(existing);
    }

    const previousValue = { status: existing.status };
    const updated = await userRepository.update(userId, { status });

    // 3. Audit log status change
    await adminRepository.recordAuditLog({
      orgId: actor.orgId || existing.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'USER',
      targetId: userId,
      action: 'SET_USER_STATUS',
      previousValue,
      newValue: { status },
      reason: reason || `User status changed from ${existing.status} to ${status}`,
      ipAddress,
    });

    return sanitizeUser(updated);
  },

  /**
   * Assign a role to a user
   */
  async assignUserRole({ actor, userId, roleId, reason = '', ipAddress = null }) {
    // 1. Guard against self-escalation
    if (actor.id === userId) {
      const error = new Error('Security Violation: Administrators cannot modify their own role.');
      error.statusCode = 403;
      throw error;
    }

    // 2. Fetch target user
    const existing = await userRepository.findById(userId);
    if (!existing) {
      const error = new Error(`User with ID '${userId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // 3. Verify target role exists
    const role = (await roleRepository.findRoleById(roleId)) || (await roleRepository.findRoleByName(roleId));
    if (!role) {
      const error = new Error(`Role '${roleId}' does not exist.`);
      error.statusCode = 404;
      throw error;
    }

    const previousValue = { roleId: existing.roleId, roleName: existing.roleName };
    const updated = await userRepository.update(userId, { roleId: role.id });

    // 4. Audit log role assignment
    await adminRepository.recordAuditLog({
      orgId: actor.orgId || existing.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'USER',
      targetId: userId,
      action: 'ASSIGN_ROLE',
      previousValue,
      newValue: { roleId: role.id, roleName: role.name },
      reason: reason || `Role changed to ${role.name}`,
      ipAddress,
    });

    return sanitizeUser(updated);
  },

  // =========================================================================
  // 2. ROLE & PERMISSION MANAGEMENT
  // =========================================================================

  /**
   * List all system roles with aggregated permissions
   */
  async listRoles() {
    return await roleRepository.findAllRoles();
  },

  /**
   * Get single role by ID with permissions
   */
  async getRoleById(roleId) {
    const role = await roleRepository.findRoleById(roleId);
    if (!role) {
      const error = new Error(`Role with ID '${roleId}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return role;
  },

  /**
   * Create a new role with optional initial permissions
   */
  async createRole({ actor, roleData, ipAddress = null }) {
    const { name, description = '', permissions = [] } = roleData;
    if (!name || !name.trim()) {
      const error = new Error('Role name is required.');
      error.statusCode = 400;
      throw error;
    }

    // Check duplicate
    const existing = await roleRepository.findRoleByName(name.trim());
    if (existing) {
      const error = new Error(`Role with name '${name.trim()}' already exists.`);
      error.statusCode = 409;
      throw error;
    }

    const newRole = await roleRepository.createRole({
      name: name.trim(),
      description,
      status: 'Active',
    });

    // If permissions provided, sync them
    let assignedPermissions = [];
    if (Array.isArray(permissions) && permissions.length > 0) {
      const synced = await roleRepository.syncRolePermissions(newRole.id, permissions);
      assignedPermissions = synced.permissions || [];
    }

    // Audit log
    await adminRepository.recordAuditLog({
      orgId: actor.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'ROLE',
      targetId: newRole.id,
      action: 'CREATE_ROLE',
      previousValue: null,
      newValue: {
        id: newRole.id,
        name: newRole.name,
        description: newRole.description,
        permissions: assignedPermissions,
      },
      reason: roleData.reason || 'Admin created new system role',
      ipAddress,
    });

    return await roleRepository.findRoleById(newRole.id);
  },

  /**
   * Update role metadata (name, description, status)
   */
  async updateRole({ actor, roleId, roleData, ipAddress = null }) {
    const existing = await roleRepository.findRoleById(roleId);
    if (!existing) {
      const error = new Error(`Role with ID '${roleId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Prevent deactivating system core Admin role
    if (roleId === 'role-admin' && roleData.status && roleData.status !== 'Active') {
      const error = new Error('Security Violation: The primary system Administrator role cannot be deactivated.');
      error.statusCode = 400;
      throw error;
    }

    const previousValue = {
      name: existing.name,
      description: existing.description,
      status: existing.status,
    };

    const updated = await roleRepository.updateRole(roleId, roleData);

    await adminRepository.recordAuditLog({
      orgId: actor.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'ROLE',
      targetId: roleId,
      action: 'UPDATE_ROLE',
      previousValue,
      newValue: {
        name: updated.name,
        description: updated.description,
        status: updated.status,
      },
      reason: roleData.reason || 'Admin updated role definition',
      ipAddress,
    });

    return updated;
  },

  /**
   * Assign/replace permissions for a role
   */
  async assignRolePermissions({ actor, roleId, permissionIds, ipAddress = null }) {
    const existing = await roleRepository.findRoleById(roleId);
    if (!existing) {
      const error = new Error(`Role with ID '${roleId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    const previousValue = { permissions: existing.permissions || [] };
    const updated = await roleRepository.syncRolePermissions(roleId, permissionIds);

    await adminRepository.recordAuditLog({
      orgId: actor.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'ROLE',
      targetId: roleId,
      action: 'ASSIGN_PERMISSION',
      previousValue,
      newValue: { permissions: updated.permissions || [] },
      reason: `Assigned ${permissionIds.length} permissions to role '${existing.name}'`,
      ipAddress,
    });

    return updated;
  },

  /**
   * Revoke a single permission from a role
   */
  async revokeRolePermission({ actor, roleId, permissionId, ipAddress = null }) {
    const existing = await roleRepository.findRoleById(roleId);
    if (!existing) {
      const error = new Error(`Role with ID '${roleId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    // Verify permission
    let perm = await roleRepository.findPermissionById(permissionId);
    if (!perm) {
      perm = await roleRepository.findPermissionByCode(permissionId);
    }
    if (!perm) {
      const error = new Error(`Permission '${permissionId}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    await roleRepository.revokePermission(roleId, perm.id);
    const updated = await roleRepository.findRoleById(roleId);

    await adminRepository.recordAuditLog({
      orgId: actor.orgId || 'org-1',
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'ROLE',
      targetId: roleId,
      action: 'REVOKE_PERMISSION',
      previousValue: { permissionCode: perm.code, permissionId: perm.id },
      newValue: { permissions: updated.permissions || [] },
      reason: `Revoked permission '${perm.code}' from role '${existing.name}'`,
      ipAddress,
    });

    return updated;
  },

  /**
   * List all system permissions grouped by module
   */
  async listPermissions() {
    const permissions = await roleRepository.findAllPermissions();
    const grouped = {};

    for (const p of permissions) {
      const mod = p.module || 'general';
      if (!grouped[mod]) grouped[mod] = [];
      grouped[mod].push(p);
    }

    return {
      total: permissions.length,
      permissions,
      groupedByModule: grouped,
    };
  },

  // =========================================================================
  // 3. ADMINISTRATIVE CONFIGURATIONS (PHASE 7 SETTINGS)
  // =========================================================================

  /**
   * Get administrative configurations for an organization
   */
  async getConfigurations(orgId, category = null) {
    return await adminRepository.findConfigurations(orgId, category);
  },

  /**
   * Get configuration by specific key
   */
  async getConfigurationByKey(orgId, configKey) {
    const config = await adminRepository.findConfigByKey(orgId, configKey);
    if (!config) {
      const error = new Error(`Configuration '${configKey}' not found.`);
      error.statusCode = 404;
      throw error;
    }
    return config;
  },

  /**
   * Upsert administrative configuration with audit logging
   */
  async updateConfiguration({ actor, configKey, configValue, category, description, ipAddress = null }) {
    const orgId = actor.orgId || 'org-1';
    const existing = await adminRepository.findConfigByKey(orgId, configKey);

    const previousValue = existing ? existing.configValue : null;

    const saved = await adminRepository.upsertConfiguration({
      orgId,
      configKey,
      configValue,
      category: category || (existing ? existing.category : 'EXIT_OFFBOARDING'),
      description: description !== undefined ? description : (existing ? existing.description : ''),
      updatedBy: actor.id,
    });

    await adminRepository.recordAuditLog({
      orgId,
      actorUserId: actor.id,
      actorRole: actor.roleName || 'Admin',
      targetType: 'CONFIG',
      targetId: configKey,
      action: 'UPDATE_CONFIG',
      previousValue,
      newValue: configValue,
      reason: description || `Updated administrative setting '${configKey}'`,
      ipAddress,
    });

    return saved;
  },

  // =========================================================================
  // 4. AUDIT LOGS & SYSTEM OVERVIEW
  // =========================================================================

  /**
   * Query immutable admin audit logs with filters and pagination
   */
  async getAuditLogs(orgId, filters = {}) {
    return await adminRepository.findAuditLogs(orgId, filters);
  },

  /**
   * Administrative overview for dashboard monitoring
   */
  async getSystemOverview(orgId) {
    return await adminRepository.getAdminSystemOverview(orgId);
  },

  /**
   * Generic audit log recorder for all modules
   */
  async logAction(auditData) {
    try {
      return await adminRepository.recordAuditLog(auditData);
    } catch (err) {
      console.warn('Audit logging error:', err.message);
    }
  },
};
