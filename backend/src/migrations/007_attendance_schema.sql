-- =====================================================================
-- Migration 007: Phase 4 Attendance Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Attendance Records Table
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    total_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(50) NOT NULL DEFAULT 'PRESENT', -- PRESENT, ABSENT, HALF_DAY, LATE, ON_LEAVE, HOLIDAY, WEEKEND, REGULARIZED
    shift_id VARCHAR(64) DEFAULT NULL,
    break_duration_minutes INT NOT NULL DEFAULT 0,
    overtime_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    source VARCHAR(50) NOT NULL DEFAULT 'WEB', -- WEB, MOBILE, BIOMETRIC, MANUAL, API
    ip_address VARCHAR(45) DEFAULT '',
    location JSONB NOT NULL DEFAULT '{}'::jsonb, -- { latitude, longitude, address, geofenceStatus }
    is_regularized BOOLEAN NOT NULL DEFAULT FALSE,
    regularization_reason TEXT DEFAULT '',
    regularized_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    regularized_at TIMESTAMPTZ DEFAULT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Uniqueness: Exactly 1 daily attendance record per employee per date
    CONSTRAINT uk_attendance_employee_date UNIQUE (employee_id, attendance_date),
    
    -- Integrity: Check-out cannot logically occur before check-in
    CONSTRAINT chk_attendance_checkout_after_checkin CHECK (
        check_out IS NULL OR check_in IS NULL OR check_out >= check_in
    ),
    
    -- Integrity: Non-negative hours and durations
    CONSTRAINT chk_attendance_hours_non_negative CHECK (
        total_hours >= 0.00 AND overtime_hours >= 0.00 AND break_duration_minutes >= 0
    )
);

-- 2. Trigger for updated_at audit timestamp
DROP TRIGGER IF EXISTS trg_attendance_records_updated_at ON attendance_records;
CREATE TRIGGER trg_attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. Performance & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_attendance_org_id ON attendance_records(org_id);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_id ON attendance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance_records(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_org_date ON attendance_records(org_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_employee_date ON attendance_records(employee_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status ON attendance_records(status);
CREATE INDEX IF NOT EXISTS idx_attendance_is_regularized ON attendance_records(is_regularized);

-- 4. Seed Permissions for Attendance Module
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-att-read', 'attendance:read', 'View Attendance', 'attendance', 'View attendance logs, summaries and records', NOW(), NOW()),
  ('perm-att-write', 'attendance:write', 'Punch / Manage Attendance', 'attendance', 'Record check-in/out and modify attendance', NOW(), NOW()),
  ('perm-att-reg', 'attendance:regularize', 'Regularize Attendance', 'attendance', 'Submit and approve attendance regularization requests', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Attendance permissions to existing roles (Admin, HR, Manager, Employee)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- Admin has full attendance access
  (r.name = 'Admin' AND p.code IN ('attendance:read', 'attendance:write', 'attendance:regularize'))
  -- HR has full attendance access
  OR (r.name = 'HR' AND p.code IN ('attendance:read', 'attendance:write', 'attendance:regularize'))
  -- Manager can view, record, and regularize team attendance
  OR (r.name = 'Manager' AND p.code IN ('attendance:read', 'attendance:write', 'attendance:regularize'))
  -- Employee can view and record own attendance
  OR (r.name = 'Employee' AND p.code IN ('attendance:read', 'attendance:write'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

