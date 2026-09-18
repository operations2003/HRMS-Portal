import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authenticate } from '../middleware/authMiddleware.js';
import { authorize, requireRoles } from '../middleware/rbacMiddleware.js';

const router = Router();

// =========================================================================
// STRICT SECURITY GATE: All Admin routes require authentication AND Admin role
// Non-admins (Employees, Managers, unauthorized HR) are blocked unconditionally
// =========================================================================
router.use(authenticate);
router.use(requireRoles(['Admin', 'SuperAdmin', 'OrgAdmin']));

// =========================================================================
// 1. User Administration & Role Assignment
// =========================================================================
router.get(
  '/users',
  authorize(['admin:read', 'user:read']),
  adminController.listUsers
);

router.get(
  '/users/:id',
  authorize(['admin:read', 'user:read']),
  adminController.getUserById
);

router.post(
  '/users',
  authorize(['admin:write', 'user:write']),
  adminController.createUser
);

router.put(
  '/users/:id',
  authorize(['admin:write', 'user:write']),
  adminController.updateUser
);

router.patch(
  '/users/:id/status',
  authorize(['admin:write']),
  adminController.setUserStatus
);

router.put(
  '/users/:id/role',
  authorize(['admin:rbac']),
  adminController.assignUserRole
);

// =========================================================================
// 2. Role & Permission Management (RBAC)
// =========================================================================
router.get(
  '/roles',
  authorize(['admin:read']),
  adminController.listRoles
);

router.get(
  '/roles/:id',
  authorize(['admin:read']),
  adminController.getRoleById
);

router.post(
  '/roles',
  authorize(['admin:rbac']),
  adminController.createRole
);

router.put(
  '/roles/:id',
  authorize(['admin:rbac']),
  adminController.updateRole
);

router.put(
  '/roles/:id/permissions',
  authorize(['admin:rbac']),
  adminController.assignRolePermissions
);

router.delete(
  '/roles/:id/permissions/:permissionId',
  authorize(['admin:rbac']),
  adminController.revokeRolePermission
);

router.get(
  '/permissions',
  authorize(['admin:read']),
  adminController.listPermissions
);

// =========================================================================
// 3. Administrative Configurations (Phase 7 Settings)
// =========================================================================
router.get(
  '/configurations',
  authorize(['admin:read']),
  adminController.getConfigurations
);

router.get(
  '/configurations/:key',
  authorize(['admin:read']),
  adminController.getConfigurationByKey
);

router.put(
  '/configurations',
  authorize(['admin:write']),
  adminController.updateConfiguration
);

// =========================================================================
// 4. Audit Trail & System Overview
// =========================================================================
router.get(
  '/audit-logs',
  authorize(['admin:read']),
  adminController.getAuditLogs
);

router.get(
  '/overview',
  authorize(['admin:read']),
  adminController.getSystemOverview
);

export default router;
