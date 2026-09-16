-- Migration 018: Standardize designations to 14 company job titles and remove previously present designations

-- 1. Insert or update the 14 standardized designations for org-1
INSERT INTO designations (id, org_id, title, code, status, created_at, updated_at)
VALUES
  ('desig-ops-tl', 'org-1', 'Operations Team Leader', 'OPS-TL', 'Active', NOW(), NOW()),
  ('desig-hr-exec', 'org-1', 'HR Executive', 'HR-EXEC', 'Active', NOW(), NOW()),
  ('desig-ops-exec', 'org-1', 'Operations Executive', 'OPS-EXEC', 'Active', NOW(), NOW()),
  ('desig-ta-int', 'org-1', 'Talent Acquisition Intern', 'TA-INT', 'Active', NOW(), NOW()),
  ('desig-ta-spec', 'org-1', 'Talent Acquisition Specialist', 'TA-SPEC', 'Active', NOW(), NOW()),
  ('desig-hr-int', 'org-1', 'HR Intern', 'HR-INT', 'Active', NOW(), NOW()),
  ('desig-it-exec', 'org-1', 'IT Executive', 'IT-EXEC', 'Active', NOW(), NOW()),
  ('desig-it-int', 'org-1', 'IT Intern', 'IT-INT', 'Active', NOW(), NOW()),
  ('desig-bdm-supp', 'org-1', 'BDM Support', 'BDM-SUPP', 'Active', NOW(), NOW()),
  ('desig-bdm-exec', 'org-1', 'BDM Executive', 'BDM-EXEC', 'Active', NOW(), NOW()),
  ('desig-ta-head', 'org-1', 'Talent Acquisition Head', 'TA-HEAD', 'Active', NOW(), NOW()),
  ('desig-ops-head', 'org-1', 'Operations Head', 'OPS-HEAD', 'Active', NOW(), NOW()),
  ('desig-acct-exec', 'org-1', 'Account Executive', 'ACCT-EXEC', 'Active', NOW(), NOW()),
  ('desig-ta-tl', 'org-1', 'Talent Acquisition Team Leader', 'TA-TL', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE
SET title = EXCLUDED.title, status = 'Active', updated_at = NOW();

-- 2. Remap any employees referencing old designations to IT Executive
UPDATE employees
SET desig_id = 'desig-it-exec'
WHERE desig_id IS NOT NULL
  AND desig_id NOT IN (
    'desig-ops-tl', 'desig-hr-exec', 'desig-ops-exec', 'desig-ta-int',
    'desig-ta-spec', 'desig-hr-int', 'desig-it-exec', 'desig-it-int',
    'desig-bdm-supp', 'desig-bdm-exec', 'desig-ta-head', 'desig-ops-head',
    'desig-acct-exec', 'desig-ta-tl'
  );

-- Remap any new_hires referencing old designations if any exist
UPDATE new_hires
SET desig_id = 'desig-it-exec'
WHERE desig_id IS NOT NULL
  AND desig_id NOT IN (
    'desig-ops-tl', 'desig-hr-exec', 'desig-ops-exec', 'desig-ta-int',
    'desig-ta-spec', 'desig-hr-int', 'desig-it-exec', 'desig-it-int',
    'desig-bdm-supp', 'desig-bdm-exec', 'desig-ta-head', 'desig-ops-head',
    'desig-acct-exec', 'desig-ta-tl'
  );

-- 3. Delete old designations
DELETE FROM designations
WHERE id NOT IN (
  'desig-ops-tl', 'desig-hr-exec', 'desig-ops-exec', 'desig-ta-int',
  'desig-ta-spec', 'desig-hr-int', 'desig-it-exec', 'desig-it-int',
  'desig-bdm-supp', 'desig-bdm-exec', 'desig-ta-head', 'desig-ops-head',
  'desig-acct-exec', 'desig-ta-tl'
);
