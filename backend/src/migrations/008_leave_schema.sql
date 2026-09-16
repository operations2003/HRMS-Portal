-- =====================================================================
-- Migration 008: Phase 4 Leave Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Leave Types Table
CREATE TABLE IF NOT EXISTS leave_types (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(50) NOT NULL,
    description TEXT DEFAULT '',
    days_per_year NUMERIC(5, 1) NOT NULL DEFAULT 12.0,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    carry_forward_days NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_leave_types_org_code UNIQUE (org_id, code)
);

-- Trigger for leave_types updated_at
DROP TRIGGER IF EXISTS trg_leave_types_updated_at ON leave_types;
CREATE TRIGGER trg_leave_types_updated_at
BEFORE UPDATE ON leave_types
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for Leave Types
CREATE INDEX IF NOT EXISTS idx_leave_types_org_id ON leave_types(org_id);
CREATE INDEX IF NOT EXISTS idx_leave_types_status ON leave_types(status);


-- 2. Create Leave Balances Table (Employee Quotas & Tracking)
CREATE TABLE IF NOT EXISTS leave_balances (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type_id VARCHAR(64) NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    year INT NOT NULL,
    allocated_days NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    used_days NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    pending_days NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    remaining_days NUMERIC(5, 1) GENERATED ALWAYS AS (allocated_days - used_days - pending_days) STORED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_leave_balances_emp_type_year UNIQUE (employee_id, leave_type_id, year),
    CONSTRAINT chk_leave_balances_non_negative CHECK (
        allocated_days >= 0.0 AND used_days >= 0.0 AND pending_days >= 0.0
    )
);

-- Trigger for leave_balances updated_at
DROP TRIGGER IF EXISTS trg_leave_balances_updated_at ON leave_balances;
CREATE TRIGGER trg_leave_balances_updated_at
BEFORE UPDATE ON leave_balances
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for Leave Balances
CREATE INDEX IF NOT EXISTS idx_leave_balances_org_id ON leave_balances(org_id);
CREATE INDEX IF NOT EXISTS idx_leave_balances_employee_year ON leave_balances(employee_id, year);
CREATE INDEX IF NOT EXISTS idx_leave_balances_type ON leave_balances(leave_type_id);


-- 3. Create Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    leave_type_id VARCHAR(64) NOT NULL REFERENCES leave_types(id) ON DELETE RESTRICT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_half_day BOOLEAN NOT NULL DEFAULT FALSE,
    half_day_period VARCHAR(20) DEFAULT NULL, -- FIRST_HALF, SECOND_HALF, NULL
    total_days NUMERIC(4, 1) NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED, CANCELLED
    applied_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approver_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    approver_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    action_date TIMESTAMPTZ DEFAULT NULL,
    rejection_reason TEXT DEFAULT '',
    cancellation_reason TEXT DEFAULT '',
    cancelled_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Check constraints
    CONSTRAINT chk_leave_requests_dates CHECK (start_date <= end_date),
    CONSTRAINT chk_leave_requests_days_positive CHECK (total_days > 0.0),
    CONSTRAINT chk_leave_requests_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT chk_leave_requests_half_day CHECK (
        (is_half_day = FALSE AND half_day_period IS NULL) OR
        (is_half_day = TRUE AND half_day_period IN ('FIRST_HALF', 'SECOND_HALF') AND start_date = end_date AND total_days = 0.5)
    )
);

-- Trigger for leave_requests updated_at
DROP TRIGGER IF EXISTS trg_leave_requests_updated_at ON leave_requests;
CREATE TRIGGER trg_leave_requests_updated_at
BEFORE UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 4. Overlap Prevention Trigger Function
CREATE OR REPLACE FUNCTION validate_leave_request_overlap()
RETURNS TRIGGER AS $$
DECLARE
    existing_rec RECORD;
BEGIN
    -- Only validate active requests (PENDING or APPROVED)
    IF NEW.status IN ('PENDING', 'APPROVED') THEN
        SELECT id, start_date, end_date, is_half_day, half_day_period, status INTO existing_rec
        FROM leave_requests
        WHERE employee_id = NEW.employee_id
          AND id <> COALESCE(NEW.id, '')
          AND status IN ('PENDING', 'APPROVED')
          AND start_date <= NEW.end_date
          AND end_date >= NEW.start_date
          AND (
              -- If either is full day, they overlap
              (NEW.is_half_day = FALSE OR is_half_day = FALSE)
              -- If both are half day on same date, they overlap if same half period
              OR (NEW.is_half_day = TRUE AND is_half_day = TRUE AND NEW.start_date = start_date AND NEW.half_day_period = half_day_period)
          )
        LIMIT 1;

        IF existing_rec.id IS NOT NULL THEN
            RAISE EXCEPTION 'Overlapping leave conflict: Employee already has an active % leave request (%) from % to %',
                existing_rec.status, existing_rec.id, existing_rec.start_date, existing_rec.end_date
                USING ERRCODE = '23505';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_leave_overlap ON leave_requests;
CREATE TRIGGER trg_validate_leave_overlap
BEFORE INSERT OR UPDATE ON leave_requests
FOR EACH ROW
EXECUTE FUNCTION validate_leave_request_overlap();

-- 5. Performance & Query Indexes
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_id ON leave_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_employee_id ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_type_id ON leave_requests(leave_type_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_leave_requests_approver ON leave_requests(approver_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_org_status ON leave_requests(org_id, status);

-- 6. Seed Standard Leave Types for Default Organization (org-1)
INSERT INTO leave_types (id, org_id, name, code, description, days_per_year, is_paid, requires_approval, carry_forward_days, status, created_at, updated_at)
VALUES
  ('lt-cl', 'org-1', 'Casual Leave', 'CL', 'Casual leave for personal matters', 12.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()),
  ('lt-sl', 'org-1', 'Sick Leave', 'SL', 'Leave for medical and health recovery', 10.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()),
  ('lt-pl', 'org-1', 'Privilege / Earned Leave', 'PL', 'Earned annual privilege leave', 15.0, TRUE, TRUE, 30.0, 'Active', NOW(), NOW()),
  ('lt-ml', 'org-1', 'Maternity Leave', 'ML', 'Maternity leave for new mothers', 180.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()),
  ('lt-patl', 'org-1', 'Paternity Leave', 'PATL', 'Paternity leave for new fathers', 15.0, TRUE, TRUE, 0.0, 'Active', NOW(), NOW()),
  ('lt-lwp', 'org-1', 'Leave Without Pay', 'LWP', 'Unpaid leave of absence', 0.0, FALSE, TRUE, 0.0, 'Active', NOW(), NOW())
ON CONFLICT (org_id, code) DO NOTHING;

-- 7. Seed Permissions for Leave Module
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-leave-read', 'leave:read', 'View Leaves', 'leave', 'View leave requests, types and balances', NOW(), NOW()),
  ('perm-leave-write', 'leave:write', 'Apply / Manage Leaves', 'leave', 'Apply for leave and cancel own pending requests', NOW(), NOW()),
  ('perm-leave-app', 'leave:approve', 'Approve / Reject Leaves', 'leave', 'Approve or reject team employee leave requests', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Leave permissions to existing roles (Admin, HR, Manager, Employee)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- Admin has full leave control
  (r.name = 'Admin' AND p.code IN ('leave:read', 'leave:write', 'leave:approve'))
  -- HR has full leave control
  OR (r.name = 'HR' AND p.code IN ('leave:read', 'leave:write', 'leave:approve'))
  -- Manager can view, apply, and approve team leaves
  OR (r.name = 'Manager' AND p.code IN ('leave:read', 'leave:write', 'leave:approve'))
  -- Employee can view and apply for own leaves
  OR (r.name = 'Employee' AND p.code IN ('leave:read', 'leave:write'))
ON CONFLICT (role_id, permission_id) DO NOTHING;

