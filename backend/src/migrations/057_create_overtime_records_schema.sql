-- =====================================================================
-- Migration 057: Separate Overtime Sessions Schema
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Overtime Records Table
CREATE TABLE IF NOT EXISTS overtime_records (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    attendance_record_id VARCHAR(64) REFERENCES attendance_records(id) ON DELETE SET NULL,
    overtime_date DATE NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ DEFAULT NULL,
    duration_hours NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    duration_minutes INT NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, CANCELLED
    notes TEXT DEFAULT '',
    source VARCHAR(50) NOT NULL DEFAULT 'WEB', -- WEB, MOBILE, MANUAL, API
    ip_address VARCHAR(45) DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Integrity: end_time cannot logically occur before start_time
    CONSTRAINT chk_overtime_end_after_start CHECK (
        end_time IS NULL OR end_time >= start_time
    ),

    -- Integrity: Non-negative hours and durations
    CONSTRAINT chk_overtime_duration_non_negative CHECK (
        duration_hours >= 0.00 AND duration_minutes >= 0
    )
);

-- 2. Trigger for updated_at audit timestamp
DROP TRIGGER IF EXISTS trg_overtime_records_updated_at ON overtime_records;
CREATE TRIGGER trg_overtime_records_updated_at
BEFORE UPDATE ON overtime_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 3. Performance & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_overtime_org_id ON overtime_records(org_id);
CREATE INDEX IF NOT EXISTS idx_overtime_employee_id ON overtime_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_overtime_date ON overtime_records(overtime_date);
CREATE INDEX IF NOT EXISTS idx_overtime_org_date ON overtime_records(org_id, overtime_date);
CREATE INDEX IF NOT EXISTS idx_overtime_employee_date ON overtime_records(employee_id, overtime_date);
CREATE INDEX IF NOT EXISTS idx_overtime_status ON overtime_records(status);
CREATE INDEX IF NOT EXISTS idx_overtime_attendance_ref ON overtime_records(attendance_record_id);

