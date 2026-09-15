-- =====================================================================
-- Migration 005: Seed Roles, Permissions, and Baseline Users for Phase 1
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Permissions (11 System Permissions)
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-1', 'dashboard:read', 'View Dashboard', 'dashboard', 'Access dashboard analytics and stats', NOW(), NOW()),
  ('perm-2', 'org:read', 'View Organizations', 'organization', 'View organization listing and details', NOW(), NOW()),
  ('perm-3', 'org:write', 'Create/Edit Organization', 'organization', 'Create and update organizations', NOW(), NOW()),
  ('perm-4', 'org:delete', 'Delete Organization', 'organization', 'Deactivate or delete organizations', NOW(), NOW()),
  ('perm-5', 'employee:read', 'View Employees', 'employee', 'View employee directory and profiles', NOW(), NOW()),
  ('perm-6', 'employee:write', 'Create/Edit Employee', 'employee', 'Create and update employee records', NOW(), NOW()),
  ('perm-7', 'employee:delete', 'Delete Employee', 'employee', 'Deactivate or delete employees', NOW(), NOW()),
  ('perm-8', 'dept:read', 'View Departments', 'department', 'View departments and designations', NOW(), NOW()),
  ('perm-9', 'dept:write', 'Manage Departments', 'department', 'Create and edit departments', NOW(), NOW()),
  ('perm-10', 'user:read', 'View Users', 'user', 'View user accounts and roles', NOW(), NOW()),
  ('perm-11', 'user:write', 'Manage Users', 'user', 'Create and update user accounts', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 2. System and Architecture Roles
INSERT INTO roles (id, name, description, status, created_at, updated_at)
VALUES
  -- Required Roles by Architecture
  ('role-admin', 'ADMIN', 'System Administrator with full control', 'Active', NOW(), NOW()),
  ('role-hr', 'HR', 'Human Resources Manager with employee lifecycle management', 'Active', NOW(), NOW()),
  ('role-manager', 'MANAGER', 'Department Manager with team visibility and reporting', 'Active', NOW(), NOW()),
  ('role-employee-upper', 'EMPLOYEE', 'Standard employee with profile and directory access', 'Active', NOW(), NOW()),
  -- Backward-Compatible Roles for Existing Frontend & Seed Accounts
  ('role-superadmin', 'SuperAdmin', 'System-wide Super Administrator', 'Active', NOW(), NOW()),
  ('role-orgadmin', 'OrgAdmin', 'Organization-level Administrator', 'Active', NOW(), NOW()),
  ('role-hrmanager', 'HRManager', 'HR Manager', 'Active', NOW(), NOW()),
  ('role-employee', 'Employee', 'Standard Employee', 'Active', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 3. Role Permissions Mapping
-- Helper CTE to insert mappings safely
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- ADMIN & SuperAdmin have all 11 permissions
  (r.name IN ('ADMIN', 'SuperAdmin'))
  -- OrgAdmin has all except system delete
  OR (r.name = 'OrgAdmin' AND p.code IN (
    'dashboard:read', 'org:read', 'org:write',
    'employee:read', 'employee:write', 'employee:delete',
    'dept:read', 'dept:write', 'user:read', 'user:write'
  ))
  -- HR & HRManager
  OR (r.name IN ('HR', 'HRManager') AND p.code IN (
    'dashboard:read', 'org:read', 'employee:read', 'employee:write', 'dept:read', 'user:read'
  ))
  -- MANAGER
  OR (r.name = 'MANAGER' AND p.code IN (
    'dashboard:read', 'employee:read', 'dept:read'
  ))
  -- EMPLOYEE & Employee
  OR (r.name IN ('EMPLOYEE', 'Employee') AND p.code IN (
    'dashboard:read', 'employee:read'
  ))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Baseline Users with Secure Bcrypt Hashes (10 Salt Rounds)
INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES
  (
    'user-admin', 'org-1', 'role-superadmin',
    'admin@hrms.local',
    '$2a$10$sBj3kYaerI1K.E1A6WQtDewI06yKAEWhbqX6qa2xAIQPDePAQe.CK', -- Admin@123
    'Super', 'Administrator', 'Active', NOW(), NOW()
  ),
  (
    'user-orgadmin', 'org-1', 'role-orgadmin',
    'orgadmin@techcorp.local',
    '$2a$10$yC4ejrtmmTar9Sq6qHD1H.Nq1HL2WyQ1/AXou1uJVlOBq2B8hQBry', -- OrgAdmin@123
    'Elena', 'Rostova', 'Active', NOW(), NOW()
  ),
  (
    'user-hr', 'org-1', 'role-hrmanager',
    'hr@techcorp.local',
    '$2a$10$g0Sb1Y4k6PTYewxeFG6nGOn.QrrPk7pRME4Ap6Jl2fC5klLp7eTPW', -- Hr@123
    'Marcus', 'Vance', 'Active', NOW(), NOW()
  ),
  (
    'user-emp', 'org-1', 'role-employee',
    'emp@techcorp.local',
    '$2a$10$MF7iZ3zoj41tnYD1.03z1.9hSc5ozF9DmF5J/EMBZcNaAZpqaGHgO', -- Emp@123
    'Sophia', 'Chen', 'Active', NOW(), NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- 5. User-Roles Junction Mapping
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, u.role_id FROM users u
WHERE u.role_id IS NOT NULL
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 6. Link Employees to User Accounts
UPDATE employees SET user_id = 'user-admin' WHERE id = 'emp-1' AND user_id IS NULL;
UPDATE employees SET user_id = 'user-emp' WHERE id = 'emp-2' AND user_id IS NULL;
UPDATE employees SET user_id = 'user-hr' WHERE id = 'emp-3' AND user_id IS NULL;

