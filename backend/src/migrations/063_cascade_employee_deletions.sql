-- Migration 063: Cascade Employee Deletions
-- Purpose: Allow HR and Admin to cleanly delete employee records without foreign key constraint violations.
-- Updates table foreign keys referencing employees(id) to ON DELETE CASCADE or ON DELETE SET NULL.

-- 1. Attendance & Overtime
ALTER TABLE attendance_records 
  DROP CONSTRAINT IF EXISTS attendance_records_employee_id_fkey,
  ADD CONSTRAINT attendance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE overtime_records 
  DROP CONSTRAINT IF EXISTS overtime_records_employee_id_fkey,
  ADD CONSTRAINT overtime_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 2. Training / Courses
ALTER TABLE course_enrollments 
  DROP CONSTRAINT IF EXISTS course_enrollments_employee_id_fkey,
  ADD CONSTRAINT course_enrollments_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 3. Leaves
ALTER TABLE leave_requests 
  DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey,
  ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE leave_balances 
  DROP CONSTRAINT IF EXISTS leave_balances_employee_id_fkey,
  ADD CONSTRAINT leave_balances_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 4. Requests, Skills & Recognitions
ALTER TABLE employee_requests 
  DROP CONSTRAINT IF EXISTS employee_requests_employee_id_fkey,
  ADD CONSTRAINT employee_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_skills 
  DROP CONSTRAINT IF EXISTS employee_skills_employee_id_fkey,
  ADD CONSTRAINT employee_skills_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_recognitions 
  DROP CONSTRAINT IF EXISTS employee_recognitions_recipient_id_fkey,
  ADD CONSTRAINT employee_recognitions_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_recognitions 
  DROP CONSTRAINT IF EXISTS employee_recognitions_sender_id_fkey,
  ADD CONSTRAINT employee_recognitions_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 5. Expense Claims & Helpdesk
ALTER TABLE expense_claims 
  DROP CONSTRAINT IF EXISTS expense_claims_employee_id_fkey,
  ADD CONSTRAINT expense_claims_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE expense_claims 
  DROP CONSTRAINT IF EXISTS expense_claims_manager_id_fkey,
  ADD CONSTRAINT expense_claims_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE helpdesk_tickets 
  DROP CONSTRAINT IF EXISTS helpdesk_tickets_employee_id_fkey,
  ADD CONSTRAINT helpdesk_tickets_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

-- 6. Performance & Tasks
ALTER TABLE performance_records 
  DROP CONSTRAINT IF EXISTS performance_records_employee_id_fkey,
  ADD CONSTRAINT performance_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE performance_goals 
  DROP CONSTRAINT IF EXISTS performance_goals_employee_id_fkey,
  ADD CONSTRAINT performance_goals_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE probation_evaluations 
  DROP CONSTRAINT IF EXISTS probation_evaluations_employee_id_fkey,
  ADD CONSTRAINT probation_evaluations_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE probation_evaluations 
  DROP CONSTRAINT IF EXISTS probation_evaluations_manager_id_fkey,
  ADD CONSTRAINT probation_evaluations_manager_id_fkey FOREIGN KEY (manager_id) REFERENCES employees(id) ON DELETE SET NULL;

ALTER TABLE work_tasks 
  DROP CONSTRAINT IF EXISTS work_tasks_assignee_id_fkey,
  ADD CONSTRAINT work_tasks_assignee_id_fkey FOREIGN KEY (assignee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE work_tasks 
  DROP CONSTRAINT IF EXISTS work_tasks_creator_id_fkey,
  ADD CONSTRAINT work_tasks_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE work_tasks 
  DROP CONSTRAINT IF EXISTS work_tasks_rated_by_fkey,
  ADD CONSTRAINT work_tasks_rated_by_fkey FOREIGN KEY (rated_by) REFERENCES employees(id) ON DELETE SET NULL;

-- 7. Workflows, Exit & Offboarding
ALTER TABLE approval_workflows 
  DROP CONSTRAINT IF EXISTS approval_workflows_requester_id_fkey,
  ADD CONSTRAINT approval_workflows_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE exit_requests 
  DROP CONSTRAINT IF EXISTS exit_requests_employee_id_fkey,
  ADD CONSTRAINT exit_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE exit_checklists 
  DROP CONSTRAINT IF EXISTS exit_checklists_employee_id_fkey,
  ADD CONSTRAINT exit_checklists_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE exit_clearance_checklists 
  DROP CONSTRAINT IF EXISTS exit_clearance_checklists_employee_id_fkey,
  ADD CONSTRAINT exit_clearance_checklists_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE fnf_settlements 
  DROP CONSTRAINT IF EXISTS fnf_settlements_employee_id_fkey,
  ADD CONSTRAINT fnf_settlements_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE internship_exit_requests 
  DROP CONSTRAINT IF EXISTS internship_exit_requests_intern_id_fkey,
  ADD CONSTRAINT internship_exit_requests_intern_id_fkey FOREIGN KEY (intern_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE employee_offboardings 
  DROP CONSTRAINT IF EXISTS employee_offboardings_employee_id_fkey,
  ADD CONSTRAINT employee_offboardings_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;

ALTER TABLE access_deprovisioning_audits 
  DROP CONSTRAINT IF EXISTS access_deprovisioning_audits_employee_id_fkey,
  ADD CONSTRAINT access_deprovisioning_audits_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE;
