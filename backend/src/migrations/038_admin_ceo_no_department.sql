-- Migration 038: Ensure Admin has no department and is designated as CEO everywhere
-- 1. Insert or update the CEO designation
INSERT INTO designations (id, org_id, title, code, status, created_at, updated_at)
VALUES ('desig-ceo', 'org-1', 'CEO', 'CEO', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE
SET title = 'CEO', status = 'Active', updated_at = NOW();

-- 2. Update Admin employees: dept_id = NULL and desig_id = 'desig-ceo'
UPDATE employees
SET dept_id = NULL,
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
