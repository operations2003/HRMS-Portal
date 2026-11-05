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

-- 5. No baseline holidays seeded.
--    Per policy: Holidays are declared exclusively by the CEO (Sheetal Bedi) through the
--    Company Holiday Management section in the HRMS Portal. No Indian calendar holidays
--    or any pre-seeded defaults are inserted. The CEO declares holidays as needed.

