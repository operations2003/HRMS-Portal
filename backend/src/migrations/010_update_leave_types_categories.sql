-- Migration 010: Standardize Leave Types to Emergency, Sick, and Casual across all organizations

-- 1. Update Org-1 Leave Types
UPDATE leave_types 
SET name = 'Casual', code = 'CL', description = 'Casual leave for personal matters', days_per_year = 12.0, status = 'Active', updated_at = NOW() 
WHERE code = 'CL' AND org_id = 'org-1';

UPDATE leave_types 
SET name = 'Sick', code = 'SL', description = 'Leave for medical and health recovery', days_per_year = 10.0, status = 'Active', updated_at = NOW() 
WHERE code = 'SL' AND org_id = 'org-1';

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES ('lt-el', 'org-1', 'Emergency', 'EL', 'Leave for unforeseen emergencies and urgent personal matters', 10.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Emergency', status = 'Active', days_per_year = 10.0, updated_at = NOW();

-- Deactivate other leave types for org-1 so only Emergency, Sick, and Casual are active
UPDATE leave_types 
SET status = 'Inactive', updated_at = NOW() 
WHERE org_id = 'org-1' AND code NOT IN ('EL', 'SL', 'CL');

-- 2. Seed Emergency, Sick, and Casual for all other organizations
INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
SELECT 
  'lt-' || o.id || '-el', o.id, 'Emergency', 'EL', 'Leave for unforeseen emergencies and urgent personal matters', 10.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()
FROM organizations o
WHERE o.id != 'org-1'
ON CONFLICT (org_id, code) DO UPDATE SET name = 'Emergency', status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
SELECT 
  'lt-' || o.id || '-sl', o.id, 'Sick', 'SL', 'Leave for medical and health recovery', 10.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()
FROM organizations o
WHERE o.id != 'org-1'
ON CONFLICT (org_id, code) DO UPDATE SET name = 'Sick', status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
SELECT 
  'lt-' || o.id || '-cl', o.id, 'Casual', 'CL', 'Casual leave for personal matters', 12.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()
FROM organizations o
WHERE o.id != 'org-1'
ON CONFLICT (org_id, code) DO UPDATE SET name = 'Casual', status = 'Active', updated_at = NOW();
