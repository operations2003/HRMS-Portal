-- =====================================================================
-- Migration 032: Add HR Assignment & Hierarchy Management to Employees
-- 1. Add hr_id column to employees table with foreign key reference
-- 2. Create performance indexes for hr_id lookups
-- 3. Assign default HR & Manager links to baseline seed records
-- =====================================================================

-- 1. Add hr_id to employees table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'hr_id'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN hr_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Index for rapid HR-scoped queries
CREATE INDEX IF NOT EXISTS idx_employees_hr_id ON employees(hr_id);

-- 3. Seed baseline manager & HR assignments for test data if existing
DO $$
DECLARE
    hr_emp_id VARCHAR(64);
    admin_emp_id VARCHAR(64);
BEGIN
    -- Locate Marcus Vance (HR Manager) or an employee with HR role
    SELECT e.id INTO hr_emp_id 
    FROM employees e
    JOIN users u ON u.id = e.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) IN ('hr', 'hrmanager')
    LIMIT 1;

    -- If no user-linked HR found, try by email or fallback to emp-3
    IF hr_emp_id IS NULL THEN
        SELECT id INTO hr_emp_id FROM employees WHERE id = 'emp-3' OR email LIKE '%hr%';
    END IF;

    -- Locate Admin / Manager employee
    SELECT e.id INTO admin_emp_id
    FROM employees e
    JOIN users u ON u.id = e.user_id
    JOIN roles r ON r.id = u.role_id
    WHERE LOWER(r.name) IN ('admin', 'superadmin', 'manager')
    LIMIT 1;

    IF admin_emp_id IS NULL THEN
        SELECT id INTO admin_emp_id FROM employees WHERE id = 'emp-1';
    END IF;

    -- Update employees who are not the HR themselves
    IF hr_emp_id IS NOT NULL THEN
        UPDATE employees
        SET hr_id = hr_emp_id
        WHERE hr_id IS NULL AND id != hr_emp_id;
    END IF;

    -- Update employees without manager who are not the top admin
    IF admin_emp_id IS NOT NULL THEN
        UPDATE employees
        SET manager_id = admin_emp_id
        WHERE manager_id IS NULL AND id != admin_emp_id AND id != hr_emp_id;
    END IF;
END $$;
