-- =====================================================================
-- Migration 012: Phase 5 Payroll Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Payroll Profiles Table (Employee Salary & Payment Configuration)
CREATE TABLE IF NOT EXISTS payroll_profiles (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL UNIQUE REFERENCES employees(id) ON DELETE RESTRICT,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (base_salary >= 0.00),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER' CHECK (
        payment_method IN ('BANK_TRANSFER', 'CHECK', 'CASH', 'DIRECT_DEPOSIT')
    ),
    bank_name VARCHAR(100) DEFAULT '',
    bank_account_number VARCHAR(50) DEFAULT '',
    bank_ifsc_routing VARCHAR(50) DEFAULT '',
    tax_id VARCHAR(50) DEFAULT '',
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_payroll_profiles_updated_at ON payroll_profiles;
CREATE TRIGGER trg_payroll_profiles_updated_at
BEFORE UPDATE ON payroll_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payroll_profiles_org ON payroll_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_profiles_employee ON payroll_profiles(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_profiles_status ON payroll_profiles(status);


-- 2. Create Payroll Periods Table (Payroll Cycles & Batches)
CREATE TABLE IF NOT EXISTS payroll_periods (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    period_name VARCHAR(100) NOT NULL,
    period_code VARCHAR(50) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    payment_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'PROCESSING', 'PROCESSED', 'PAID', 'CANCELLED')
    ),
    total_employees INT NOT NULL DEFAULT 0 CHECK (total_employees >= 0),
    total_gross_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_gross_amount >= 0.00),
    total_net_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_net_amount >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uk_payroll_period_org_code UNIQUE (org_id, period_code),
    CONSTRAINT chk_payroll_period_dates CHECK (end_date >= start_date),
    CONSTRAINT chk_payroll_period_payment_date CHECK (payment_date >= start_date)
);

DROP TRIGGER IF EXISTS trg_payroll_periods_updated_at ON payroll_periods;
CREATE TRIGGER trg_payroll_periods_updated_at
BEFORE UPDATE ON payroll_periods
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payroll_periods_org ON payroll_periods(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON payroll_periods(status);
CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON payroll_periods(start_date, end_date);


-- 3. Create Payroll Records Table (Per-Employee Compensation for a Period)
CREATE TABLE IF NOT EXISTS payroll_records (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    period_id VARCHAR(64) NOT NULL REFERENCES payroll_periods(id) ON DELETE RESTRICT,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    base_salary NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (base_salary >= 0.00),
    gross_earnings NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (gross_earnings >= 0.00),
    total_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (total_deductions >= 0.00),
    net_payable NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (net_payable >= 0.00),
    working_days NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (working_days >= 0.00),
    paid_days NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (paid_days >= 0.00),
    loss_of_pay_days NUMERIC(5, 2) NOT NULL DEFAULT 0.00 CHECK (loss_of_pay_days >= 0.00),
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'PROCESSING', 'PROCESSED', 'PAID', 'CANCELLED')
    ),
    payment_method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER' CHECK (
        payment_method IN ('BANK_TRANSFER', 'CHECK', 'CASH', 'DIRECT_DEPOSIT')
    ),
    payment_reference VARCHAR(100) DEFAULT '',
    paid_at TIMESTAMPTZ DEFAULT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate payroll records for the same employee in the same period
    CONSTRAINT uk_payroll_record_employee_period UNIQUE (employee_id, period_id),
    -- Mathematical consistency: net_payable = gross_earnings - total_deductions
    CONSTRAINT chk_payroll_record_net_payable CHECK (net_payable = (gross_earnings - total_deductions)),
    -- Logical consistency: paid_days cannot exceed working_days
    CONSTRAINT chk_payroll_record_paid_days CHECK (paid_days <= working_days)
);

DROP TRIGGER IF EXISTS trg_payroll_records_updated_at ON payroll_records;
CREATE TRIGGER trg_payroll_records_updated_at
BEFORE UPDATE ON payroll_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payroll_records_org ON payroll_records(org_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee ON payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_period ON payroll_records(period_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_status ON payroll_records(status);
CREATE INDEX IF NOT EXISTS idx_payroll_records_org_period ON payroll_records(org_id, period_id);


-- 4. Create Payroll Items Table (Earnings & Deductions Itemized Breakdown)
CREATE TABLE IF NOT EXISTS payroll_items (
    id VARCHAR(64) PRIMARY KEY,
    payroll_record_id VARCHAR(64) NOT NULL REFERENCES payroll_records(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('EARNING', 'DEDUCTION')),
    category VARCHAR(50) NOT NULL, -- e.g. BASIC, HRA, SPECIAL_ALLOWANCE, BONUS, OVERTIME, TDS, PF, PROFESSIONAL_TAX, LOP
    name VARCHAR(100) NOT NULL,
    amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00 CHECK (amount >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_payroll_items_updated_at ON payroll_items;
CREATE TRIGGER trg_payroll_items_updated_at
BEFORE UPDATE ON payroll_items
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payroll_items_record ON payroll_items(payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payroll_items_type ON payroll_items(item_type);
CREATE INDEX IF NOT EXISTS idx_payroll_items_category ON payroll_items(category);


-- 5. Create Payslips Table (Payslip Metadata & Document Vault Reference)
CREATE TABLE IF NOT EXISTS payslips (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    payroll_record_id VARCHAR(64) NOT NULL UNIQUE REFERENCES payroll_records(id) ON DELETE RESTRICT,
    payslip_number VARCHAR(64) NOT NULL UNIQUE,
    document_vault_id VARCHAR(64) REFERENCES document_vault(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'GENERATED' CHECK (
        status IN ('GENERATED', 'PUBLISHED', 'WITHHELD')
    ),
    issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
    download_count INT NOT NULL DEFAULT 0 CHECK (download_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_payslips_updated_at ON payslips;
CREATE TRIGGER trg_payslips_updated_at
BEFORE UPDATE ON payslips
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_payslips_org ON payslips(org_id);
CREATE INDEX IF NOT EXISTS idx_payslips_employee ON payslips(employee_id);
CREATE INDEX IF NOT EXISTS idx_payslips_payroll_record ON payslips(payroll_record_id);
CREATE INDEX IF NOT EXISTS idx_payslips_number ON payslips(payslip_number);
CREATE INDEX IF NOT EXISTS idx_payslips_status ON payslips(status);


-- 6. Seed Baseline Payroll Profiles for Existing Employees
INSERT INTO payroll_profiles (id, org_id, employee_id, currency, base_salary, payment_method, status, created_at, updated_at)
SELECT 
    'pp-' || e.id,
    e.org_id,
    e.id,
    'INR',
    COALESCE(e.salary, 0.00),
    'BANK_TRANSFER',
    'Active',
    NOW(),
    NOW()
FROM employees e
ON CONFLICT (employee_id) DO UPDATE 
SET base_salary = EXCLUDED.base_salary, updated_at = NOW();


-- 7. Seed Initial Payroll Period for org-1
INSERT INTO payroll_periods (id, org_id, period_name, period_code, start_date, end_date, payment_date, status, created_at, updated_at)
VALUES (
    'pp-org1-2026-09',
    'org-1',
    'September 2026 Payroll',
    '2026-M09',
    '2026-09-01',
    '2026-09-30',
    '2026-09-30',
    'DRAFT',
    NOW(),
    NOW()
)
ON CONFLICT (org_id, period_code) DO NOTHING;


-- 8. Register Phase 5 Payroll Permissions in RBAC Framework
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
    ('perm-payroll-read', 'payroll:read', 'View Payroll', 'payroll', 'View payroll periods, records and employee compensation', NOW(), NOW()),
    ('perm-payroll-write', 'payroll:write', 'Manage Payroll Profiles', 'payroll', 'Configure employee payroll profiles and compensation items', NOW(), NOW()),
    ('perm-payroll-process', 'payroll:process', 'Process Payroll Cycles', 'payroll', 'Run, approve and finalize monthly payroll periods and payments', NOW(), NOW()),
    ('perm-payslip-read', 'payslip:read', 'View Payslips', 'payroll', 'Access and download issued payslip documents', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Payroll Permissions to Core Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
    -- Admin has complete payroll authority
    (r.name = 'Admin' AND p.code IN ('payroll:read', 'payroll:write', 'payroll:process', 'payslip:read'))
    OR
    -- HR can view, configure profiles, process runs, and view payslips
    (r.name = 'HR' AND p.code IN ('payroll:read', 'payroll:write', 'payroll:process', 'payslip:read'))
    OR
    -- Managers can view departmental payroll and payslips
    (r.name = 'Manager' AND p.code IN ('payroll:read', 'payslip:read'))
    OR
    -- Employees can view their own payslips
    (r.name = 'Employee' AND p.code IN ('payslip:read'))
ON CONFLICT DO NOTHING;

