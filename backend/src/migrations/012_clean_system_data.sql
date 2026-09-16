-- Migration 012: Clean all test and demo data from the system except the Admin

-- 1. Clear onboarding and candidate records
DELETE FROM document_vault;
DELETE FROM onboarding_documents;
DELETE FROM onboarding_checklists;
DELETE FROM onboarding_it_setup;
DELETE FROM new_hires;
DELETE FROM onboarding_candidates;

-- 2. Clear attendance tracking records
DELETE FROM attendance_records;

-- 3. Clear leave requests
DELETE FROM leave_requests;

-- 4. Remove leave balances for non-admin employees and reset admin balances
DELETE FROM leave_balances WHERE employee_id != 'emp-shubham-admin';
UPDATE leave_balances 
SET used_days = 0.0, pending_days = 0.0, updated_at = NOW() 
WHERE employee_id = 'emp-shubham-admin';

-- 5. Clear payroll profiles for non-admin employees
DELETE FROM payslips WHERE employee_id != 'emp-shubham-admin';
DELETE FROM payroll_records WHERE employee_id != 'emp-shubham-admin';
DELETE FROM payroll_profiles WHERE employee_id != 'emp-shubham-admin';

-- 6. Clear helpdesk and ticket comments if any
DELETE FROM ticket_comments WHERE user_id != 'user-superadmin-shubham';
DELETE FROM helpdesk_tickets WHERE employee_id != 'emp-shubham-admin';

-- 7. Delete all non-admin employees
DELETE FROM employees 
WHERE id != 'emp-shubham-admin' 
  AND (user_id IS NULL OR user_id != 'user-superadmin-shubham');

-- 8. Delete all non-admin user roles
DELETE FROM user_roles WHERE user_id != 'user-superadmin-shubham';

-- 9. Delete all non-admin users
DELETE FROM users 
WHERE id != 'user-superadmin-shubham' 
  AND email NOT IN ('shubham@tasknera.com', 'shubhamtasknera.com');
