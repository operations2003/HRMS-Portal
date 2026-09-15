-- =====================================================================
-- Migration 004: Seed Baseline Employees for Phase 1
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

INSERT INTO employees (
  id, org_id, dept_id, desig_id, user_id, employee_code,
  first_name, last_name, email, phone, date_of_joining,
  employment_type, status, salary, created_at, updated_at
) VALUES
  ('emp-1', 'org-1', 'dept-1', 'desig-1', NULL, 'EMP-001', 'Super', 'Administrator', 'admin@hrms.local', '+1 (555) 100-0001', '2025-01-01', 'Full-Time', 'Active', 185000, NOW(), NOW()),
  ('emp-2', 'org-1', 'dept-1', 'desig-2', NULL, 'EMP-002', 'Sophia', 'Chen', 'emp@techcorp.local', '+1 (555) 234-5678', '2025-03-15', 'Full-Time', 'Active', 140000, NOW(), NOW()),
  ('emp-3', 'org-1', 'dept-2', 'desig-3', NULL, 'EMP-003', 'Marcus', 'Vance', 'hr@techcorp.local', '+1 (555) 345-6789', '2025-04-01', 'Full-Time', 'Active', 115000, NOW(), NOW()),
  ('emp-4', 'org-1', 'dept-3', 'desig-4', NULL, 'EMP-004', 'Liam', 'Gallagher', 'liam.g@techcorp.com', '+1 (555) 456-7890', '2025-06-20', 'Contract', 'On Leave', 95000, NOW(), NOW()),
  ('emp-5', 'org-2', 'dept-5', 'desig-5', NULL, 'EMP-005', 'Aarav', 'Patel', 'aarav.p@apexlogistics.com', '+1 (555) 567-8901', '2025-08-10', 'Full-Time', 'Active', 88000, NOW(), NOW())
ON CONFLICT (org_id, employee_code) DO NOTHING;

