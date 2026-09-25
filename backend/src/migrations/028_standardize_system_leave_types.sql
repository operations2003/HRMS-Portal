-- Migration 028: Standardize Leave Types across the System
-- Categories: Planned Leave, Casual Leave, Sick Leave, Holiday, Half Day,
-- Absent Without Leave(AWOL), Leave without pay (LOP), Maternity Leave, Sabbatical Leave, Paternity Leave

-- 1. Insert/Update Standard 11 Leave Types for org-1
INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-pl', 'org-1', 'Planned Leave', 'PL', 'Pre-planned annual leave and scheduled vacations', 15.0, TRUE, TRUE, 10.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Planned Leave', description = 'Pre-planned annual leave and scheduled vacations', days_per_year = 15.0, is_paid = TRUE, requires_approval = TRUE, status = 'Active', updated_at = NOW();



INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-cl', 'org-1', 'Casual Leave', 'CL', 'Casual leave for personal affairs and short breaks', 12.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Casual Leave', description = 'Casual leave for personal affairs and short breaks', days_per_year = 12.0, is_paid = TRUE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-sl', 'org-1', 'Sick Leave', 'SL', 'Medical leave for illness or health recovery', 10.0, TRUE, TRUE, 5.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Sick Leave', description = 'Medical leave for illness or health recovery', days_per_year = 10.0, is_paid = TRUE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-hl', 'org-1', 'Holiday', 'HL', 'Official public holiday or declared company day-off', 10.0, TRUE, FALSE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Holiday', description = 'Official public holiday or declared company day-off', days_per_year = 10.0, is_paid = TRUE, requires_approval = FALSE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-hdl', 'org-1', 'Half Day', 'HDL', 'Half-day leave for morning or afternoon session (0.5 day)', 6.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Half Day', description = 'Half-day leave for morning or afternoon session (0.5 day)', days_per_year = 6.0, is_paid = TRUE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-awol', 'org-1', 'Absent Without Leave(AWOL)', 'AWOL', 'Unauthorized absence without prior notice or approved leave', 0.0, FALSE, FALSE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Absent Without Leave(AWOL)', description = 'Unauthorized absence without prior notice or approved leave', days_per_year = 0.0, is_paid = FALSE, requires_approval = FALSE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-lop', 'org-1', 'Leave without pay (LOP)', 'LOP', 'Loss of pay / unpaid leave of absence', 0.0, FALSE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Leave without pay (LOP)', description = 'Loss of pay / unpaid leave of absence', days_per_year = 0.0, is_paid = FALSE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-ml', 'org-1', 'Maternity Leave', 'ML', 'Maternity leave for prenatal, postnatal, and childcare recovery', 180.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Maternity Leave', description = 'Maternity leave for prenatal, postnatal, and childcare recovery', days_per_year = 180.0, is_paid = TRUE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-sbl', 'org-1', 'Sabbatical Leave', 'SBL', 'Extended leave for research, education, or personal enrichment', 30.0, FALSE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Sabbatical Leave', description = 'Extended leave for research, education, or personal enrichment', days_per_year = 30.0, is_paid = FALSE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-ptl', 'org-1', 'Paternity Leave', 'PTL', 'Paternity leave for new fathers upon birth or adoption', 15.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = 'Paternity Leave', description = 'Paternity leave for new fathers upon birth or adoption', days_per_year = 15.0, is_paid = TRUE, requires_approval = TRUE, status = 'Active', updated_at = NOW();

-- Also ensure legacy PATL, LWP, or EL are marked Inactive if not needed
UPDATE leave_types SET status = 'Inactive' WHERE org_id = 'org-1' AND code NOT IN ('PL', 'CL', 'SL', 'HL', 'HDL', 'AWOL', 'LOP', 'ML', 'SBL', 'PTL');

-- 2. Seed for any other registered organizations
INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
SELECT 
  'lt-' || o.id || '-' || LOWER(lt.code), o.id, lt.name, lt.code, lt.description, lt.days_per_year, lt.is_paid, lt.requires_approval, lt.carry_forward_days, 'Active', NOW(), NOW()
FROM organizations o
CROSS JOIN (
  SELECT * FROM leave_types WHERE org_id = 'org-1' AND status = 'Active'
) lt
WHERE o.id != 'org-1'
ON CONFLICT (org_id, code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, days_per_year = EXCLUDED.days_per_year, is_paid = EXCLUDED.is_paid, status = 'Active', updated_at = NOW();
