-- =====================================================================
-- Migration 009: Phase 4 Holiday Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    holiday_date DATE NOT NULL,
    holiday_type VARCHAR(50) NOT NULL DEFAULT 'NATIONAL', -- NATIONAL, REGIONAL, COMPANY, OPTIONAL
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'Active', -- Active, Inactive
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Prevent duplicate holidays on the same date for the same organization
    CONSTRAINT uk_holidays_org_date UNIQUE (org_id, holiday_date),
    
    -- Valid status check
    CONSTRAINT chk_holidays_status CHECK (status IN ('Active', 'Inactive')),
    
    -- Valid holiday type check
    CONSTRAINT chk_holidays_type CHECK (holiday_type IN ('NATIONAL', 'REGIONAL', 'COMPANY', 'OPTIONAL'))
);

-- 2. Trigger for holidays updated_at audit timestamp
DROP TRIGGER IF EXISTS trg_holidays_updated_at ON holidays;
CREATE TRIGGER trg_holidays_updated_at
BEFORE UPDATE ON holidays
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. Indexes for Holidays
CREATE INDEX IF NOT EXISTS idx_holidays_org_id ON holidays(org_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_org_date ON holidays(org_id, holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_org_status ON holidays(org_id, status);
CREATE INDEX IF NOT EXISTS idx_holidays_type ON holidays(holiday_type);

-- 4. Seed Permissions for Holiday Module
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-hol-read', 'holiday:read', 'View Holidays', 'holiday', 'View company holiday calendars and public holidays', NOW(), NOW()),
  ('perm-hol-write', 'holiday:write', 'Manage Holidays', 'holiday', 'Create, update, and manage company holidays', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Holiday permissions to existing roles (Admin, HR, Manager, Employee)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- Admin has full holiday control
  (r.name = 'Admin' AND p.code IN ('holiday:read', 'holiday:write'))
  -- HR has full holiday control
  OR (r.name = 'HR' AND p.code IN ('holiday:read', 'holiday:write'))
  -- Manager can view holiday calendar
  OR (r.name = 'Manager' AND p.code IN ('holiday:read'))
  -- Employee can view holiday calendar
  OR (r.name = 'Employee' AND p.code IN ('holiday:read'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 5. Seed Safe Baseline Test Holidays for Default Organization (org-1)
INSERT INTO holidays (id, org_id, name, holiday_date, holiday_type, is_optional, description, status, created_at, updated_at)
VALUES
  ('hol-2026-01', 'org-1', 'New Year''s Day', '2026-01-01', 'NATIONAL', FALSE, 'Global celebration of the Gregorian new year', 'Active', NOW(), NOW()),
  ('hol-2026-02', 'org-1', 'Republic Day', '2026-01-26', 'NATIONAL', FALSE, 'Commemoration of the Constitution enactment', 'Active', NOW(), NOW()),
  ('hol-2026-03', 'org-1', 'International Workers'' Day', '2026-05-01', 'COMPANY', FALSE, 'Public celebration of the international labor movement', 'Active', NOW(), NOW()),
  ('hol-2026-04', 'org-1', 'Independence Day', '2026-08-15', 'NATIONAL', FALSE, 'National Independence celebration', 'Active', NOW(), NOW()),
  ('hol-2026-05', 'org-1', 'Gandhi Jayanti', '2026-10-02', 'NATIONAL', FALSE, 'National commemoration and non-violence day', 'Active', NOW(), NOW()),
  ('hol-2026-06', 'org-1', 'Christmas Day', '2026-12-25', 'NATIONAL', FALSE, 'Annual religious and cultural holiday', 'Active', NOW(), NOW()),
  ('hol-2026-07', 'org-1', 'Annual Founder''s Day', '2026-11-15', 'OPTIONAL', TRUE, 'Optional company-wide floating cultural observance', 'Active', NOW(), NOW())
ON CONFLICT (org_id, holiday_date) DO NOTHING;

