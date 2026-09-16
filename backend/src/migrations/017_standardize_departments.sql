-- Migration 017: Standardize departments to Operations, HR, Talent Acquisition, Learning & Development, IT, Business Development, and remove previously present departments

-- 1. Ensure description column exists
ALTER TABLE departments ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';

-- 2. Insert or update the 6 standardized departments for org-1
INSERT INTO departments (id, org_id, name, code, description, status, created_at, updated_at)
VALUES 
  ('dept-ops', 'org-1', 'Operations', 'OPS', 'Business and operational workflow execution', 'Active', NOW(), NOW()),
  ('dept-hr', 'org-1', 'HR', 'HR', 'Human resource management and employee experience', 'Active', NOW(), NOW()),
  ('dept-ta', 'org-1', 'Talent Acquisition', 'TA', 'Recruitment, hiring pipelines, and talent sourcing', 'Active', NOW(), NOW()),
  ('dept-ld', 'org-1', 'Learning & Development', 'L&D', 'Training, skill enhancement, and employee growth programs', 'Active', NOW(), NOW()),
  ('dept-it', 'org-1', 'IT', 'IT', 'Information technology, software infrastructure, and systems', 'Active', NOW(), NOW()),
  ('dept-bd', 'org-1', 'Business Development', 'BD', 'Client partnerships, market expansion, and business growth', 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO UPDATE 
SET name = EXCLUDED.name, description = EXCLUDED.description, status = 'Active', updated_at = NOW();

-- 3. Remap any employees referencing other departments to IT (dept-it)
UPDATE employees 
SET dept_id = 'dept-it' 
WHERE dept_id IS NOT NULL 
  AND dept_id NOT IN ('dept-ops', 'dept-hr', 'dept-ta', 'dept-ld', 'dept-it', 'dept-bd');

-- 4. Delete all previous departments
DELETE FROM departments 
WHERE id NOT IN ('dept-ops', 'dept-hr', 'dept-ta', 'dept-ld', 'dept-it', 'dept-bd');
