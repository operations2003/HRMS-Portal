-- Migration 011: Standardize single organization to Tasknera Global HR Solutions and remove legacy demo organizations

-- 1. Rename org-1 to Tasknera Global HR Solutions
UPDATE organizations 
SET name = 'Tasknera Global HR Solutions', 
    code = 'TASKNERA', 
    email = 'contact@tasknera.com', 
    website = 'https://tasknera.com',
    status = 'Active',
    updated_at = NOW()
WHERE id = 'org-1';

-- 2. Consolidate foreign key references from org-2 and org-3 to org-1
UPDATE users SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');
UPDATE employees SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');
UPDATE departments SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');
UPDATE designations SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');
UPDATE onboarding_candidates SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');
UPDATE attendance_records SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');
UPDATE holidays SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');

-- 3. Re-assign leave requests to org-1 and standardized leave types
UPDATE leave_requests SET leave_type_id = 'lt-el', org_id = 'org-1' WHERE leave_type_id IN ('lt-org-2-el', 'lt-org-3-el');
UPDATE leave_requests SET leave_type_id = 'lt-sl', org_id = 'org-1' WHERE leave_type_id IN ('lt-org-2-sl', 'lt-org-3-sl');
UPDATE leave_requests SET leave_type_id = 'lt-cl', org_id = 'org-1' WHERE leave_type_id IN ('lt-org-2-cl', 'lt-org-3-cl');
UPDATE leave_requests SET org_id = 'org-1' WHERE org_id IN ('org-2', 'org-3');

-- 4. Re-assign leave balances to org-1 and standardized leave types
UPDATE leave_balances SET leave_type_id = 'lt-el', org_id = 'org-1' 
WHERE leave_type_id IN ('lt-org-2-el', 'lt-org-3-el')
AND NOT EXISTS (
  SELECT 1 FROM leave_balances lb2 
  WHERE lb2.employee_id = leave_balances.employee_id 
    AND lb2.leave_type_id = 'lt-el' 
    AND lb2.year = leave_balances.year
);

UPDATE leave_balances SET leave_type_id = 'lt-sl', org_id = 'org-1' 
WHERE leave_type_id IN ('lt-org-2-sl', 'lt-org-3-sl')
AND NOT EXISTS (
  SELECT 1 FROM leave_balances lb2 
  WHERE lb2.employee_id = leave_balances.employee_id 
    AND lb2.leave_type_id = 'lt-sl' 
    AND lb2.year = leave_balances.year
);

UPDATE leave_balances SET leave_type_id = 'lt-cl', org_id = 'org-1' 
WHERE leave_type_id IN ('lt-org-2-cl', 'lt-org-3-cl')
AND NOT EXISTS (
  SELECT 1 FROM leave_balances lb2 
  WHERE lb2.employee_id = leave_balances.employee_id 
    AND lb2.leave_type_id = 'lt-cl' 
    AND lb2.year = leave_balances.year
);

DELETE FROM leave_balances WHERE org_id IN ('org-2', 'org-3');

-- 5. Delete leave types for org-2 and org-3
DELETE FROM leave_types WHERE org_id IN ('org-2', 'org-3');

-- 6. Delete legacy organizations Apex Global Logistics (org-2) and Horizon Health Systems (org-3)
DELETE FROM organizations WHERE id IN ('org-2', 'org-3');
