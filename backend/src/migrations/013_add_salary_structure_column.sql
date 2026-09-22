-- Migration 013: Add salary_structure JSONB column to employees table
-- Allows Admin/CEO and HR to manually define and edit every salary component and number

ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS salary_structure JSONB DEFAULT NULL;
