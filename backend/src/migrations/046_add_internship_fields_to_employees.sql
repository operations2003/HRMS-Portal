-- Migration 046: Add internship status and end date to employees table
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS internship_status VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS internship_end_date DATE DEFAULT NULL;
