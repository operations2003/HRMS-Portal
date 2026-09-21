-- =====================================================================
-- Migration 033: Align Employee Hierarchy & Resignation Workflow Links
-- 1. Standardize reporting manager hierarchy:
--    - Admin (emp-shubham-admin): Top of hierarchy (manager_id = NULL)
--    - HR (emp-1789806139647 / abhijeet@gmail.com): Reports to Admin
--    - Manager (emp-1789810949800 / ajay@tasknera.com): Reports to Admin
--    - Team Members (Shreya, Vishal, Edwina, Vikash): Report to Manager Ajay
-- 2. Update active approval workflows for exit requests to match assigned manager
-- =====================================================================

DO $$
DECLARE
    admin_emp_id VARCHAR(64);
    hr_emp_id VARCHAR(64);
    mgr_emp_id VARCHAR(64);
BEGIN
    -- 1. Identify Admin employee
    SELECT e.id INTO admin_emp_id
    FROM employees e
    JOIN users u ON u.id = e.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) IN ('admin', 'superadmin')
    ORDER BY (CASE WHEN e.email = 'shubham@tasknera.com' THEN 0 ELSE 1 END)
    LIMIT 1;

    -- Fallback for Admin
    IF admin_emp_id IS NULL THEN
        SELECT id INTO admin_emp_id FROM employees WHERE id = 'emp-shubham-admin' OR email = 'shubham@tasknera.com';
    END IF;

    -- 2. Identify HR employee
    SELECT e.id INTO hr_emp_id
    FROM employees e
    JOIN users u ON u.id = e.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) IN ('hr', 'hrmanager')
    ORDER BY (CASE WHEN e.email = 'abhijeet@gmail.com' THEN 0 ELSE 1 END)
    LIMIT 1;

    -- 3. Identify Manager employee (Ajay)
    SELECT e.id INTO mgr_emp_id
    FROM employees e
    JOIN users u ON u.id = e.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) = 'manager'
    ORDER BY (CASE WHEN e.email = 'ajay@tasknera.com' THEN 0 ELSE 1 END)
    LIMIT 1;

    -- Fallback for Manager
    IF mgr_emp_id IS NULL THEN
        SELECT id INTO mgr_emp_id FROM employees WHERE id = 'emp-1789810949800' OR email = 'ajay@tasknera.com';
    END IF;

    -- Top Admin reports to no one
    IF admin_emp_id IS NOT NULL THEN
        UPDATE employees
        SET manager_id = NULL
        WHERE id = admin_emp_id;
    END IF;

    -- HR reports to Admin
    IF hr_emp_id IS NOT NULL AND admin_emp_id IS NOT NULL THEN
        UPDATE employees
        SET manager_id = admin_emp_id
        WHERE id = hr_emp_id;
    END IF;

    -- Manager reports to Admin
    IF mgr_emp_id IS NOT NULL AND admin_emp_id IS NOT NULL THEN
        UPDATE employees
        SET manager_id = admin_emp_id
        WHERE id = mgr_emp_id;
    END IF;

    -- Team members report to Manager Ajay
    IF mgr_emp_id IS NOT NULL THEN
        UPDATE employees
        SET manager_id = mgr_emp_id
        WHERE email IN (
            'shreya@tasknera.com',
            'vishal@tasknera.com',
            'edwina@tasknera.com',
            'vikash@gmail.com'
        );
    END IF;

    -- Update active approval_workflows for exit requests to set manager_id from employee
    UPDATE approval_workflows aw
    SET manager_id = e.manager_id
    FROM employees e
    WHERE aw.entity_type = 'EXIT_REQUEST'
      AND aw.requester_id = e.id
      AND e.manager_id IS NOT NULL
      AND (aw.manager_id IS NULL OR aw.manager_id != e.manager_id);

END $$;
