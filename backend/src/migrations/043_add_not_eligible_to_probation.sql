-- Migration 043: Add 'NOT_ELIGIBLE' to probation status and evaluation constraints

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_probation_status_check;
ALTER TABLE employees ADD CONSTRAINT employees_probation_status_check 
  CHECK (probation_status IN ('IN_PROBATION', 'CONFIRMED', 'EXTENDED', 'REJECTED', 'NOT_ELIGIBLE'));

ALTER TABLE probation_evaluations DROP CONSTRAINT IF EXISTS probation_evaluations_manager_recommendation_check;
ALTER TABLE probation_evaluations ADD CONSTRAINT probation_evaluations_manager_recommendation_check 
  CHECK (manager_recommendation IN ('CONFIRM', 'EXTEND', 'REJECT', 'NOT_ELIGIBLE'));

ALTER TABLE probation_evaluations DROP CONSTRAINT IF EXISTS probation_evaluations_status_check;
ALTER TABLE probation_evaluations ADD CONSTRAINT probation_evaluations_status_check 
  CHECK (status IN ('PENDING', 'MANAGER_EVALUATED', 'CONFIRMED', 'EXTENDED', 'REJECTED', 'NOT_ELIGIBLE'));
