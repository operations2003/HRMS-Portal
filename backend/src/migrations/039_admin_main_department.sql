-- Migration 039: Create 'Main' department and assign Admin to Department 'Main' and Designation 'CEO'
-- 1. Insert or update department 'Main'
INSERT INTO departments (id, org_id, name, code, status, created_at, updated_at)
VALUES ('dept-main', 'org-1', 'Main', 'MAIN', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE
SET name = 'Main', status = 'Active', updated_at = NOW();

-- 2. Ensure CEO designation exists
INSERT INTO designations (id, org_id, title, code, status, created_at, updated_at)
VALUES ('desig-ceo', 'org-1', 'CEO', 'CEO', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE
SET title = 'CEO', status = 'Active', updated_at = NOW();

-- 3. Update Admin employees: dept_id = 'dept-main' and desig_id = 'desig-ceo'
UPDATE employees
SET dept_id = 'dept-main',
    desig_id = COALESCE(
      (SELECT id FROM designations WHERE code = 'CEO' AND org_id = 'org-1' LIMIT 1),
      'desig-ceo'
    ),
    updated_at = NOW()
WHERE id IN (
  SELECT e.id
  FROM employees e
  JOIN users u ON e.user_id = u.id
  JOIN roles r ON u.role_id = r.id
  WHERE LOWER(r.name) IN ('admin', 'superadmin')
)
OR email = 'sheetalbedi@tasknera.com'
OR id = 'emp-shubham-admin';
