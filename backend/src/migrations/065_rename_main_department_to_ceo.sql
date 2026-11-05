-- Migration 065: Rename department 'Main' to 'CEO'
-- Ensures the CEO/Admin department is consistently named and displayed as 'CEO'

UPDATE departments
SET name = 'CEO',
    code = 'CEO',
    updated_at = NOW()
WHERE id = 'dept-main' OR code = 'MAIN' OR name = 'Main';
