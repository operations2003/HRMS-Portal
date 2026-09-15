-- =====================================================================
-- Migration 003: Seed Baseline Departments and Designations for Phase 1
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Departments for org-1 and org-2
INSERT INTO departments (id, org_id, name, code, status, created_at, updated_at)
VALUES
  ('dept-1', 'org-1', 'Engineering & Technology', 'ENG', 'Active', NOW(), NOW()),
  ('dept-2', 'org-1', 'Human Resources', 'HR', 'Active', NOW(), NOW()),
  ('dept-3', 'org-1', 'Sales & Marketing', 'SALES', 'Active', NOW(), NOW()),
  ('dept-4', 'org-1', 'Finance & Accounts', 'FIN', 'Active', NOW(), NOW()),
  ('dept-5', 'org-2', 'Fleet Operations', 'OPS', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO NOTHING;

-- 2. Designations for org-1 and org-2
INSERT INTO designations (id, org_id, title, code, status, created_at, updated_at)
VALUES
  ('desig-1', 'org-1', 'Principal Software Architect', 'ARCH', 'Active', NOW(), NOW()),
  ('desig-2', 'org-1', 'Senior Full Stack Engineer', 'SDE-2', 'Active', NOW(), NOW()),
  ('desig-3', 'org-1', 'HR Operations Lead', 'HR-LEAD', 'Active', NOW(), NOW()),
  ('desig-4', 'org-1', 'Enterprise Account Executive', 'SALES-EXEC', 'Active', NOW(), NOW()),
  ('desig-5', 'org-2', 'Logistics Coordinator', 'LOG-COORD', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO NOTHING;

