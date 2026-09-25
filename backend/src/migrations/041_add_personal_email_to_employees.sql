-- 041_add_personal_email_to_employees.sql
-- Add personal_email column to employees table for self-service profile editing

ALTER TABLE employees ADD COLUMN IF NOT EXISTS personal_email VARCHAR(255);
