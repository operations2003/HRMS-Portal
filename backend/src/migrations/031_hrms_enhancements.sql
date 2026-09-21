-- =====================================================================
-- Migration 031: HRMS Enhancements
-- 1. Add Personal, Bank, and UAN fields to employees table
-- 2. Create company_policies table for organizational policies
-- 3. Extend employee_requests constraint for Bank & UAN change workflows
-- 4. Seed initial standard company policies and dummy employee bank/UAN data
-- =====================================================================

-- 1. Add Personal, Bank, and Statutory UAN details to employees table
ALTER TABLE employees
ADD COLUMN IF NOT EXISTS father_name VARCHAR(150) DEFAULT '',
ADD COLUMN IF NOT EXISTS mother_name VARCHAR(150) DEFAULT '',
ADD COLUMN IF NOT EXISTS emergency_contact VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(150) DEFAULT '',
ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50) DEFAULT '',
ADD COLUMN IF NOT EXISTS bank_ifsc VARCHAR(30) DEFAULT '',
ADD COLUMN IF NOT EXISTS bank_branch VARCHAR(150) DEFAULT '',
ADD COLUMN IF NOT EXISTS uan_number VARCHAR(30) DEFAULT '';

-- 2. Create company_policies table
CREATE TABLE IF NOT EXISTS company_policies (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'General',
    description TEXT DEFAULT '',
    document_url TEXT DEFAULT '',
    version VARCHAR(50) DEFAULT '1.0',
    effective_date DATE DEFAULT CURRENT_DATE,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_company_policies_updated_at ON company_policies;
CREATE TRIGGER trg_company_policies_updated_at
BEFORE UPDATE ON company_policies
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_company_policies_org ON company_policies(org_id);
CREATE INDEX IF NOT EXISTS idx_company_policies_cat ON company_policies(category);

-- 3. Update employee_requests CHECK constraint to include BANK_DETAILS_CHANGE and UAN_CHANGE
DO $$
BEGIN
    ALTER TABLE employee_requests DROP CONSTRAINT IF EXISTS employee_requests_request_type_check;
    ALTER TABLE employee_requests DROP CONSTRAINT IF EXISTS chk_employee_requests_type;
    ALTER TABLE employee_requests ADD CONSTRAINT employee_requests_request_type_check CHECK (
        request_type IN (
            'DOCUMENT_REQUEST',
            'HR_REQUEST',
            'PAYROLL_CLARIFICATION',
            'EMPLOYEE_SERVICE',
            'BANK_DETAILS_CHANGE',
            'UAN_CHANGE',
            'OTHER'
        )
    );
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping constraint alteration on employee_requests: %', SQLERRM;
END $$;

-- 4. Seed Standard Company Policies for TaskNera / default org
INSERT INTO company_policies (id, org_id, title, category, description, version, effective_date)
SELECT 
    'pol-code-of-conduct',
    o.id,
    'Code of Business Conduct & Ethics',
    'Conduct & Compliance',
    'Establishes standards for ethical conduct, professional integrity, conflicts of interest, and anti-corruption guidelines for all personnel.',
    '2.1',
    '2026-01-01'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM company_policies WHERE id = 'pol-code-of-conduct')
LIMIT 1;

INSERT INTO company_policies (id, org_id, title, category, description, version, effective_date)
SELECT 
    'pol-leave-attendance',
    o.id,
    'Leave & Attendance Policy',
    'Leave & Attendance',
    'Comprehensive regulations covering planned leave, sick days, working hours, flexible shifts, and manager-assigned leaves including Sabbatical and Maternity.',
    '3.0',
    '2026-01-01'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM company_policies WHERE id = 'pol-leave-attendance')
LIMIT 1;

INSERT INTO company_policies (id, org_id, title, category, description, version, effective_date)
SELECT 
    'pol-infosec-remote',
    o.id,
    'Information Security & Acceptable Use Policy',
    'Security & IT',
    'Information security practices, password management, remote access controls, clean desk regulations, and safeguarding proprietary data.',
    '1.5',
    '2026-02-15'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM company_policies WHERE id = 'pol-infosec-remote')
LIMIT 1;

INSERT INTO company_policies (id, org_id, title, category, description, version, effective_date)
SELECT 
    'pol-posh-equality',
    o.id,
    'Prevention of Sexual Harassment (POSH) Policy',
    'Conduct & Compliance',
    'Zero-tolerance policy against workplace harassment, establishing grievance redressal mechanisms and the Internal Complaints Committee (ICC).',
    '2.0',
    '2026-01-01'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM company_policies WHERE id = 'pol-posh-equality')
LIMIT 1;

INSERT INTO company_policies (id, org_id, title, category, description, version, effective_date)
SELECT 
    'pol-health-benefits',
    o.id,
    'Employee Health & Wellness Benefits',
    'Benefits & Wellness',
    'Details medical insurance coverage, accidental health benefits, wellness days, and parental support programs.',
    '1.2',
    '2026-03-01'
FROM organizations o
WHERE NOT EXISTS (SELECT 1 FROM company_policies WHERE id = 'pol-health-benefits')
LIMIT 1;

-- 5. Populate realistic default bank details, UAN, and personal details for existing employees if empty
UPDATE employees
SET 
    bank_name = CASE 
        WHEN bank_name IS NULL OR bank_name = '' THEN 'HDFC Bank' 
        ELSE bank_name 
    END,
    bank_account_number = CASE 
        WHEN bank_account_number IS NULL OR bank_account_number = '' THEN '5010049281' || LPAD((FLOOR(RANDOM() * 9000 + 1000))::text, 4, '0')
        ELSE bank_account_number 
    END,
    bank_ifsc = CASE 
        WHEN bank_ifsc IS NULL OR bank_ifsc = '' THEN 'HDFC0001234'
        ELSE bank_ifsc 
    END,
    bank_branch = CASE 
        WHEN bank_branch IS NULL OR bank_branch = '' THEN 'Cyber City Branch'
        ELSE bank_branch 
    END,
    uan_number = CASE 
        WHEN uan_number IS NULL OR uan_number = '' THEN '1012' || LPAD((FLOOR(RANDOM() * 90000000 + 10000000))::text, 8, '0')
        ELSE uan_number 
    END,
    father_name = CASE 
        WHEN father_name IS NULL OR father_name = '' THEN 'Rajesh Kumar'
        ELSE father_name 
    END,
    mother_name = CASE 
        WHEN mother_name IS NULL OR mother_name = '' THEN 'Sunita Devi'
        ELSE mother_name 
    END,
    emergency_contact = CASE 
        WHEN emergency_contact IS NULL OR emergency_contact = '' THEN '+91 98765 43210'
        ELSE emergency_contact 
    END,
    address = CASE 
        WHEN address IS NULL OR address = '' THEN 'Flat 402, Green Glen Heights, Bellandur, Bengaluru, Karnataka - 560103'
        ELSE address 
    END
WHERE bank_name IS NULL OR bank_name = '' OR uan_number IS NULL OR uan_number = '';
