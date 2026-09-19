-- Migration 029: Add gender to employees and gender eligibility to leave types

-- 1. Add gender column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'Male';

-- 2. Add gender_eligibility column to leave_types table
ALTER TABLE leave_types ADD COLUMN IF NOT EXISTS gender_eligibility VARCHAR(20) DEFAULT 'ALL';

-- 3. Set Maternity Leave to FEMALE only and Paternity Leave to MALE only
UPDATE leave_types 
SET gender_eligibility = 'FEMALE' 
WHERE code = 'ML' OR UPPER(name) LIKE '%MATERNITY%';

UPDATE leave_types 
SET gender_eligibility = 'MALE' 
WHERE code = 'PTL' OR code = 'PATL' OR UPPER(name) LIKE '%PATERNITY%';

UPDATE leave_types 
SET gender_eligibility = 'ALL' 
WHERE code NOT IN ('ML', 'PTL', 'PATL') AND UPPER(name) NOT LIKE '%MATERNITY%' AND UPPER(name) NOT LIKE '%PATERNITY%';
