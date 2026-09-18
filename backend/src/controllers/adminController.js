import { adminService } from '../services/adminService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import {
  validateCreateAdminUser,
  validateUpdateAdminUser,
  validateSetUserStatus,
  validateAssignRole,
  validateCreateRole,
  validateUpdateRole,
  validateAssignPermissions,
  validateUpdateConfig,
} from '../validators/adminValidator.js';

export const adminController = {
  // =========================================================================
  // 1. USER MANAGEMENT
  // =========================================================================

  /**
   * GET /api/v1/admin/users
   */
  async listUsers(req, res, next) {
    try {
      const { status, roleId, search } = req.query;
      const orgId = req.user.orgId;
      const users = await adminService.listUsers({ orgId, status, roleId, search });
      return sendSuccess(res, 'Users retrieved successfully.', users);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/users/:id
   */
  async getUserById(req, res, next) {
    try {
      const user = await adminService.getUserById(req.params.id);
      return sendSuccess(res, 'User details retrieved successfully.', user);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/admin/users
   */
  async createUser(req, res, next) {
    try {
      const errors = validateCreateAdminUser(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const newUser = await adminService.createUser({
        actor: req.user,
        userData: { ...req.body, orgId: req.user.orgId || req.body.orgId },
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'User created successfully.', newUser, 201);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/users/:id
   */
  async updateUser(req, res, next) {
    try {
      const errors = validateUpdateAdminUser(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const updated = await adminService.updateUser({
        actor: req.user,
        userId: req.params.id,
        updates: req.body,
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'User updated successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PATCH /api/v1/admin/users/:id/status
   */
  async setUserStatus(req, res, next) {
    try {
      const errors = validateSetUserStatus(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const updated = await adminService.setUserStatus({
        actor: req.user,
        userId: req.params.id,
        status: req.body.status,
        reason: req.body.reason || '',
        ipAddress: clientIp,
      });

      return sendSuccess(res, `User status updated to ${req.body.status}.`, updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/users/:id/role
   */
  async assignUserRole(req, res, next) {
    try {
      const errors = validateAssignRole(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const updated = await adminService.assignUserRole({
        actor: req.user,
        userId: req.params.id,
        roleId: req.body.roleId,
        reason: req.body.reason || '',
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'User role assigned successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  // =========================================================================
  // 2. ROLE & PERMISSION MANAGEMENT
  // =========================================================================

  /**
   * GET /api/v1/admin/roles
   */
  async listRoles(req, res, next) {
    try {
      const roles = await adminService.listRoles();
      return sendSuccess(res, 'Roles retrieved successfully.', roles);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/roles/:id
   */
  async getRoleById(req, res, next) {
    try {
      const role = await adminService.getRoleById(req.params.id);
      return sendSuccess(res, 'Role details retrieved successfully.', role);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * POST /api/v1/admin/roles
   */
  async createRole(req, res, next) {
    try {
      const errors = validateCreateRole(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const newRole = await adminService.createRole({
        actor: req.user,
        roleData: req.body,
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'Role created successfully.', newRole, 201);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/roles/:id
   */
  async updateRole(req, res, next) {
    try {
      const errors = validateUpdateRole(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const updated = await adminService.updateRole({
        actor: req.user,
        roleId: req.params.id,
        roleData: req.body,
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'Role updated successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/roles/:id/permissions
   */
  async assignRolePermissions(req, res, next) {
    try {
      const errors = validateAssignPermissions(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const updated = await adminService.assignRolePermissions({
        actor: req.user,
        roleId: req.params.id,
        permissionIds: req.body.permissions,
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'Role permissions updated successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * DELETE /api/v1/admin/roles/:id/permissions/:permissionId
   */
  async revokeRolePermission(req, res, next) {
    try {
      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const updated = await adminService.revokeRolePermission({
        actor: req.user,
        roleId: req.params.id,
        permissionId: req.params.permissionId,
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'Role permission revoked successfully.', updated);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/permissions
   */
  async listPermissions(req, res, next) {
    try {
      const result = await adminService.listPermissions();
      return sendSuccess(res, 'Permissions retrieved successfully.', result);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  // =========================================================================
  // 3. ADMINISTRATIVE CONFIGURATIONS
  // =========================================================================

  /**
   * GET /api/v1/admin/configurations
   */
  async getConfigurations(req, res, next) {
    try {
      const { category } = req.query;
      const configs = await adminService.getConfigurations(req.user.orgId, category);
      return sendSuccess(res, 'Configurations retrieved successfully.', configs);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/configurations/:key
   */
  async getConfigurationByKey(req, res, next) {
    try {
      const config = await adminService.getConfigurationByKey(req.user.orgId, req.params.key);
      return sendSuccess(res, 'Configuration retrieved successfully.', config);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * PUT /api/v1/admin/configurations
   */
  async updateConfiguration(req, res, next) {
    try {
      const errors = validateUpdateConfig(req.body);
      if (errors.length > 0) {
        return sendError(res, errors[0], 400, errors);
      }

      const clientIp = req.ip || req.connection?.remoteAddress || null;
      const saved = await adminService.updateConfiguration({
        actor: req.user,
        configKey: req.body.configKey,
        configValue: req.body.configValue,
        category: req.body.category,
        description: req.body.description,
        ipAddress: clientIp,
      });

      return sendSuccess(res, 'Configuration updated successfully.', saved);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  // =========================================================================
  // 4. AUDIT LOGS & SYSTEM OVERVIEW
  // =========================================================================

  /**
   * GET /api/v1/admin/audit-logs
   */
  async getAuditLogs(req, res, next) {
    try {
      const { actorUserId, targetType, targetId, action, startDate, endDate, limit, offset } = req.query;
      const logs = await adminService.getAuditLogs(req.user.orgId, {
        actorUserId,
        targetType,
        targetId,
        action,
        startDate,
        endDate,
        limit,
        offset,
      });
      return sendSuccess(res, 'Audit logs retrieved successfully.', logs);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },

  /**
   * GET /api/v1/admin/overview
   */
  async getSystemOverview(req, res, next) {
    try {
      const overview = await adminService.getSystemOverview(req.user.orgId);
      return sendSuccess(res, 'System overview retrieved successfully.', overview);
    } catch (err) {
      if (err.statusCode) return sendError(res, err.message, err.statusCode);
      next(err);
    }
  },
};
