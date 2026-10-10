-- =====================================================================
-- Migration 022: Monthly Roster Import & Synchronization System
-- Database: Supabase PostgreSQL
-- =====================================================================

-- 1. Roster Import Jobs Table (tracks upload sessions and import history)
CREATE TABLE IF NOT EXISTS roster_import_jobs (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    uploaded_by VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    original_filename VARCHAR(255) NOT NULL,
    roster_month INTEGER NOT NULL CHECK (roster_month BETWEEN 1 AND 12),
    roster_year INTEGER NOT NULL CHECK (roster_year >= 2020 AND roster_year <= 2100),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, PREVIEWED, CONFIRMED, FAILED, PARTIAL
    total_employees INTEGER DEFAULT 0,
    matched_employees INTEGER DEFAULT 0,
    unmatched_employees INTEGER DEFAULT 0,
    total_assignments INTEGER DEFAULT 0,
    new_assignments INTEGER DEFAULT 0,
    updated_assignments INTEGER DEFAULT 0,
    unchanged_assignments INTEGER DEFAULT 0,
    invalid_entries INTEGER DEFAULT 0,
    error_summary JSONB DEFAULT '[]'::jsonb,
    import_summary JSONB DEFAULT '{}'::jsonb,
    file_metadata JSONB DEFAULT '{}'::jsonb,
    confirmed_at TIMESTAMPTZ DEFAULT NULL,
    confirmed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_roster_import_jobs_updated_at
BEFORE UPDATE ON roster_import_jobs
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_roster_import_jobs_org_id ON roster_import_jobs(org_id);
CREATE INDEX IF NOT EXISTS idx_roster_import_jobs_uploaded_by ON roster_import_jobs(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_roster_import_jobs_status ON roster_import_jobs(status);
CREATE INDEX IF NOT EXISTS idx_roster_import_jobs_roster_month_year ON roster_import_jobs(roster_year, roster_month);

-- 2. Shift Assignments Table (stores daily roster assignments for employees)
CREATE TABLE IF NOT EXISTS shift_assignments (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    shift_type VARCHAR(50) NOT NULL, -- SHIFT, WO, CL, HD, NA, BLANK
    shift_start_time TIME DEFAULT NULL,
    shift_end_time TIME DEFAULT NULL,
    shift_label VARCHAR(100) DEFAULT NULL, -- Original value like "11 - 8 PM"
    is_overnight BOOLEAN DEFAULT FALSE,
    notes TEXT DEFAULT NULL,
    source VARCHAR(50) DEFAULT 'MANUAL', -- MANUAL, IMPORT, SYSTEM
    import_job_id VARCHAR(64) REFERENCES roster_import_jobs(id) ON DELETE SET NULL,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_employee_date_assignment UNIQUE (employee_id, assignment_date)
);

CREATE TRIGGER trg_shift_assignments_updated_at
BEFORE UPDATE ON shift_assignments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_shift_assignments_org_id ON shift_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee_id ON shift_assignments(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_assignment_date ON shift_assignments(assignment_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_shift_type ON shift_assignments(shift_type);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_import_job_id ON shift_assignments(import_job_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_employee_date ON shift_assignments(employee_id, assignment_date);

-- 3. Roster Employee Mapping Table (for ambiguity resolution and manual mapping)
CREATE TABLE IF NOT EXISTS roster_employee_mappings (
    id VARCHAR(64) PRIMARY KEY,
    import_job_id VARCHAR(64) NOT NULL REFERENCES roster_import_jobs(id) ON DELETE CASCADE,
    roster_employee_name VARCHAR(255) NOT NULL,
    roster_designation VARCHAR(255) DEFAULT NULL,
    matched_employee_id VARCHAR(64) REFERENCES employees(id) ON DELETE CASCADE,
    match_confidence NUMERIC(3, 2) DEFAULT 0.00, -- 0.00 to 1.00
    match_method VARCHAR(50) DEFAULT 'MANUAL', -- EXACT, FUZZY, MANUAL, UNMATCHED
    is_ambiguous BOOLEAN DEFAULT FALSE,
    alternative_matches JSONB DEFAULT '[]'::jsonb,
    resolved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_roster_employee_mappings_updated_at
BEFORE UPDATE ON roster_employee_mappings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_roster_employee_mappings_import_job_id ON roster_employee_mappings(import_job_id);
CREATE INDEX IF NOT EXISTS idx_roster_employee_mappings_matched_employee_id ON roster_employee_mappings(matched_employee_id);
CREATE INDEX IF NOT EXISTS idx_roster_employee_mappings_is_ambiguous ON roster_employee_mappings(is_ambiguous);

-- 4. Shift Assignment Audit Log (tracks changes for audit trail)
CREATE TABLE IF NOT EXISTS shift_assignment_audit (
    id VARCHAR(64) PRIMARY KEY,
    shift_assignment_id VARCHAR(64) NOT NULL,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
    assignment_date DATE NOT NULL,
    change_type VARCHAR(50) NOT NULL, -- CREATED, UPDATED, DELETED
    old_value JSONB DEFAULT NULL,
    new_value JSONB DEFAULT NULL,
    changed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    change_source VARCHAR(50) DEFAULT 'MANUAL', -- MANUAL, IMPORT, SYSTEM
    import_job_id VARCHAR(64) REFERENCES roster_import_jobs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shift_assignment_audit_shift_assignment_id ON shift_assignment_audit(shift_assignment_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignment_audit_employee_id ON shift_assignment_audit(employee_id);
CREATE INDEX IF NOT EXISTS idx_shift_assignment_audit_assignment_date ON shift_assignment_audit(assignment_date);
CREATE INDEX IF NOT EXISTS idx_shift_assignment_audit_import_job_id ON shift_assignment_audit(import_job_id);

-- 5. Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_shift_assignments_month_year ON shift_assignments(
    EXTRACT(YEAR FROM assignment_date),
    EXTRACT(MONTH FROM assignment_date)
);

-- Record migration
INSERT INTO schema_migrations (migration_name) 
VALUES ('022_roster_import_system')
ON CONFLICT (migration_name) DO NOTHING;

COMMENT ON TABLE roster_import_jobs IS 'Tracks monthly roster import sessions with status and statistics';
COMMENT ON TABLE shift_assignments IS 'Stores daily shift assignments for employees from roster imports and manual scheduling';
COMMENT ON TABLE roster_employee_mappings IS 'Maps roster employee names to HRMS employee records, handles ambiguity resolution';
COMMENT ON TABLE shift_assignment_audit IS 'Audit trail for all changes to shift assignments';
