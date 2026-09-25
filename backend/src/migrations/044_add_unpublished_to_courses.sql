-- Migration 044: Add 'UNPUBLISHED' to courses status constraint

ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_status_check;
ALTER TABLE courses ADD CONSTRAINT courses_status_check 
  CHECK (status IN ('ACTIVE', 'INACTIVE', 'PUBLISHED', 'UNPUBLISHED', 'DRAFT'));
