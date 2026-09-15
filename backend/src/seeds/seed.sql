-- =====================================================================
-- Phase 1 Foundation: Safe Test & Seed Data Script
-- Target: Supabase PostgreSQL 17+
-- Principles: 100% Fake / Non-Production Data, Pre-Hashed Bcrypt Passwords,
--             Zero Secret Leakage, 100% Idempotent (ON CONFLICT DO NOTHING)
-- =====================================================================

-- 1. Organization: Acme Global Corp
INSERT INTO organizations (id, name, code, email, phone, website, address, status, created_at, updated_at)
VALUES (
  'org-acme',
  'Acme Global Corp',
  'ACME',
  'contact@acme.example.com',
  '+1 (555) 010-9900',
  'https://acme.example.com',
  '1000 Enterprise Parkway, Suite 500, Austin, TX',
  'Active',
  NOW(),
  NOW()
)
ON CONFLICT (code) DO NOTHING;

-- 2. Departments under Acme
INSERT INTO departments (id, org_id, name, code, status, created_at, updated_at)
VALUES
  ('dept-acme-1', 'org-acme', 'Engineering', 'ENG', 'Active', NOW(), NOW()),
  ('dept-acme-2', 'org-acme', 'Human Resources', 'HR', 'Active', NOW(), NOW()),
  ('dept-acme-3', 'org-acme', 'Product Management', 'PROD', 'Active', NOW(), NOW()),
  ('dept-acme-4', 'org-acme', 'Operations', 'OPS', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO NOTHING;

-- 3. Designations under Acme
INSERT INTO designations (id, org_id, title, code, status, created_at, updated_at)
VALUES
  ('desig-acme-1', 'org-acme', 'Lead Software Engineer', 'LEAD-SWE', 'Active', NOW(), NOW()),
  ('desig-acme-2', 'org-acme', 'HR Operations Partner', 'HR-PARTNER', 'Active', NOW(), NOW()),
  ('desig-acme-3', 'org-acme', 'Senior Product Manager', 'SR-PM', 'Active', NOW(), NOW()),
  ('desig-acme-4', 'org-acme', 'Operations Analyst', 'OPS-ANALYST', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO NOTHING;

-- 4. Standard System Roles
INSERT INTO roles (id, name, description, status, created_at, updated_at)
VALUES
  ('role-admin', 'ADMIN', 'System Administrator with full access', 'Active', NOW(), NOW()),
  ('role-hr', 'HR', 'Human Resources Manager with employee lifecycle management', 'Active', NOW(), NOW()),
  ('role-manager', 'MANAGER', 'Department Manager with team visibility and approvals', 'Active', NOW(), NOW()),
  ('role-employee-upper', 'EMPLOYEE', 'Standard employee with self-service and directory access', 'Active', NOW(), NOW())
ON CONFLICT (name) DO NOTHING;

-- 5. System Permissions (11 Core Permissions)
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-1', 'dashboard:read', 'View Dashboard', 'dashboard', 'Access dashboard analytics and metrics', NOW(), NOW()),
  ('perm-2', 'org:read', 'View Organizations', 'organization', 'View organization listings and details', NOW(), NOW()),
  ('perm-3', 'org:write', 'Create/Edit Organization', 'organization', 'Create and update organizations', NOW(), NOW()),
  ('perm-4', 'org:delete', 'Delete Organization', 'organization', 'Deactivate or delete organizations', NOW(), NOW()),
  ('perm-5', 'employee:read', 'View Employees', 'employee', 'View employee directory and profiles', NOW(), NOW()),
  ('perm-6', 'employee:write', 'Create/Edit Employee', 'employee', 'Create and update employee records', NOW(), NOW()),
  ('perm-7', 'employee:delete', 'Delete Employee', 'employee', 'Deactivate or delete employees', NOW(), NOW()),
  ('perm-8', 'dept:read', 'View Departments', 'department', 'View departments and designations', NOW(), NOW()),
  ('perm-9', 'dept:write', 'Manage Departments', 'department', 'Create and edit departments', NOW(), NOW()),
  ('perm-10', 'user:read', 'View Users', 'user', 'View system user accounts and roles', NOW(), NOW()),
  ('perm-11', 'user:write', 'Manage Users', 'user', 'Create and update user accounts and roles', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- 6. Role Permissions Mapping
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- ADMIN has all 11 permissions
  (r.name = 'ADMIN')
  -- HR has employee, org view, dept view, user view
  OR (r.name = 'HR' AND p.code IN (
    'dashboard:read', 'org:read', 'employee:read', 'employee:write', 'dept:read', 'user:read'
  ))
  -- MANAGER has dashboard, employee read, dept read
  OR (r.name = 'MANAGER' AND p.code IN (
    'dashboard:read', 'employee:read', 'dept:read'
  ))
  -- EMPLOYEE has dashboard and employee directory view
  OR (r.name = 'EMPLOYEE' AND p.code IN (
    'dashboard:read', 'employee:read'
  ))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 7. Documented Test Accounts with Secure Bcrypt Hashes (10 Salt Rounds)
-- Test Passwords:
--   admin@acme.example.com    -> Admin@123
--   hr@acme.example.com       -> Hr@123
--   manager@acme.example.com  -> Manager@123
--   employee@acme.example.com -> Employee@123
INSERT INTO users (id, org_id, role_id, email, password_hash, first_name, last_name, status, created_at, updated_at)
VALUES
  (
    'user-acme-admin', 'org-acme', 'role-admin',
    'admin@acme.example.com',
    '$2a$10$sBj3kYaerI1K.E1A6WQtDewI06yKAEWhbqX6qa2xAIQPDePAQe.CK', -- Admin@123
    'Arthur', 'Dent', 'Active', NOW(), NOW()
  ),
  (
    'user-acme-hr', 'org-acme', 'role-hr',
    'hr@acme.example.com',
    '$2a$10$g0Sb1Y4k6PTYewxeFG6nGOn.QrrPk7pRME4Ap6Jl2fC5klLp7eTPW', -- Hr@123
    'Ford', 'Prefect', 'Active', NOW(), NOW()
  ),
  (
    'user-acme-manager', 'org-acme', 'role-manager',
    'manager@acme.example.com',
    '$2a$10$erm6UNmaWohmVjRKOdZ5DecaPpLrKyB8uY7iphYnb2LVLcu/qefdC', -- Manager@123
    'Tricia', 'McMillan', 'Active', NOW(), NOW()
  ),
  (
    'user-acme-emp', 'org-acme', 'role-employee-upper',
    'employee@acme.example.com',
    '$2a$10$tVhI2ZyKsBloQDt.Km/lKe7sVpCbAgFUrDnrwyDyb5dNBocBII5yC', -- Employee@123
    'Zaphod', 'Beeblebrox', 'Active', NOW(), NOW()
  )
ON CONFLICT (email) DO NOTHING;

-- 8. Relational User-Roles Junction
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, u.role_id FROM users u
WHERE u.id IN ('user-acme-admin', 'user-acme-hr', 'user-acme-manager', 'user-acme-emp')
ON CONFLICT (user_id, role_id) DO NOTHING;

-- 9. Sample Employees linked to Acme, Departments, Designations & Users
INSERT INTO employees (
  id, org_id, dept_id, desig_id, user_id, employee_code,
  first_name, last_name, email, phone, date_of_joining,
  employment_type, status, salary, created_at, updated_at
) VALUES
  (
    'emp-acme-1', 'org-acme', 'dept-acme-1', 'desig-acme-1', 'user-acme-admin', 'EMP-ACME-001',
    'Arthur', 'Dent', 'admin@acme.example.com', '+1 (555) 111-0001', '2025-01-15',
    'Full-Time', 'Active', 160000, NOW(), NOW()
  ),
  (
    'emp-acme-2', 'org-acme', 'dept-acme-2', 'desig-acme-2', 'user-acme-hr', 'EMP-ACME-002',
    'Ford', 'Prefect', 'hr@acme.example.com', '+1 (555) 111-0002', '2025-02-01',
    'Full-Time', 'Active', 125000, NOW(), NOW()
  ),
  (
    'emp-acme-3', 'org-acme', 'dept-acme-3', 'desig-acme-3', 'user-acme-manager', 'EMP-ACME-003',
    'Tricia', 'McMillan', 'manager@acme.example.com', '+1 (555) 111-0003', '2025-03-10',
    'Full-Time', 'Active', 145000, NOW(), NOW()
  ),
  (
    'emp-acme-4', 'org-acme', 'dept-acme-4', 'desig-acme-4', 'user-acme-emp', 'EMP-ACME-004',
    'Zaphod', 'Beeblebrox', 'employee@acme.example.com', '+1 (555) 111-0004', '2025-04-01',
    'Contract', 'Active', 95000, NOW(), NOW()
  )
ON CONFLICT (org_id, employee_code) DO NOTHING;

