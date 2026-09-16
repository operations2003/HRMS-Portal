-- =====================================================================
-- Migration 013: Phase 5 Payslip Data Structure & Relational Derivation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Extend payslips table to link explicitly with payroll_periods
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payslips' AND column_name = 'period_id'
    ) THEN
        ALTER TABLE payslips 
        ADD COLUMN period_id VARCHAR(64) REFERENCES payroll_periods(id) ON DELETE RESTRICT;
    END IF;
END $$;

-- Populate period_id from payroll_records if any existing records exist
UPDATE payslips ps
SET period_id = pr.period_id
FROM payroll_records pr
WHERE ps.payroll_record_id = pr.id AND ps.period_id IS NULL;

-- Enforce NOT NULL on period_id
ALTER TABLE payslips ALTER COLUMN period_id SET NOT NULL;

-- 2. Constraints & Indexing for Payslips
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'payslips' AND constraint_name = 'uk_payslips_employee_period'
    ) THEN
        ALTER TABLE payslips 
        ADD CONSTRAINT uk_payslips_employee_period UNIQUE (employee_id, period_id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_payslips_period ON payslips(period_id);
CREATE INDEX IF NOT EXISTS idx_payslips_emp_period ON payslips(employee_id, period_id);


-- 3. Comprehensive View for Employee Payslips (Zero Data Duplication)
-- Derives employee profile, organization, payroll period, and financial totals directly from authoritative sources.
CREATE OR REPLACE VIEW v_employee_payslips AS
SELECT 
    ps.id AS payslip_id,
    ps.payslip_number,
    ps.status AS payslip_status,
    ps.issue_date,
    ps.download_count,
    ps.document_vault_id,
    
    -- Organization Reference
    o.id AS org_id,
    o.name AS org_name,
    o.code AS org_code,
    
    -- Employee Information (Derived from employees, departments, designations)
    e.id AS employee_id,
    e.employee_code,
    e.first_name,
    e.last_name,
    (e.first_name || ' ' || e.last_name) AS employee_name,
    e.email AS employee_email,
    e.user_id,
    e.employment_type,
    dept.name AS department_name,
    desig.title AS designation_title,
    
    -- Payroll Period Reference & Details
    pp.id AS period_id,
    pp.period_name,
    pp.period_code,
    pp.start_date AS period_start_date,
    pp.end_date AS period_end_date,
    pp.payment_date,
    
    -- Financial Totals & Payment Details (Derived from payroll_records)
    pr.id AS payroll_record_id,
    pr.currency,
    pr.base_salary,
    pr.gross_earnings,
    pr.total_deductions,
    pr.net_payable,
    pr.working_days,
    pr.paid_days,
    pr.loss_of_pay_days,
    pr.status AS payment_status,
    pr.payment_method,
    pr.payment_reference,
    pr.paid_at,
    
    -- Audit Timestamps
    ps.created_at,
    ps.updated_at
FROM payslips ps
JOIN organizations o ON o.id = ps.org_id
JOIN employees e ON e.id = ps.employee_id
JOIN payroll_periods pp ON pp.id = ps.period_id
JOIN payroll_records pr ON pr.id = ps.payroll_record_id
LEFT JOIN departments dept ON dept.id = e.dept_id
LEFT JOIN designations desig ON desig.id = e.desig_id;


-- 4. View for Itemized Payslip Earnings & Deductions Breakdown
-- Enables client and PDF generators to fetch clean itemized breakdown without duplicating records.
CREATE OR REPLACE VIEW v_payslip_items AS
SELECT 
    pi.id AS item_id,
    ps.id AS payslip_id,
    ps.payroll_record_id,
    pi.item_type,
    pi.category,
    pi.name AS item_name,
    pi.amount,
    pi.created_at
FROM payroll_items pi
JOIN payslips ps ON ps.payroll_record_id = pi.payroll_record_id;

