-- =====================================================================
-- Migration 020: Phase 6 Performance Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Extend employees table with manager_id if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'employees' AND column_name = 'manager_id'
    ) THEN
        ALTER TABLE employees 
        ADD COLUMN manager_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_employees_manager_id ON employees(manager_id);

-- 2. Performance Review Periods Table
CREATE TABLE IF NOT EXISTS performance_periods (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,
    period_type VARCHAR(50) NOT NULL DEFAULT 'ANNUAL' CHECK (
        period_type IN ('ANNUAL', 'MID_YEAR', 'QUARTERLY', 'PROBATION', 'SPECIAL')
    ),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_date DATE,
    status VARCHAR(30) NOT NULL DEFAULT 'ACTIVE' CHECK (
        status IN ('ACTIVE', 'CLOSED', 'ARCHIVED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_perf_periods_org_code UNIQUE (org_id, code),
    CONSTRAINT chk_perf_periods_dates CHECK (end_date >= start_date)
);

DROP TRIGGER IF EXISTS trg_perf_periods_updated_at ON performance_periods;
CREATE TRIGGER trg_perf_periods_updated_at
BEFORE UPDATE ON performance_periods
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_perf_periods_org ON performance_periods(org_id);
CREATE INDEX IF NOT EXISTS idx_perf_periods_status ON performance_periods(status);
CREATE INDEX IF NOT EXISTS idx_perf_periods_dates ON performance_periods(start_date, end_date);

-- 3. Performance Records Table (Evaluation & Appraisal Lifecycle)
CREATE TABLE IF NOT EXISTS performance_records (
    id VARCHAR(64) PRIMARY KEY,
    record_number VARCHAR(64) NOT NULL UNIQUE,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    reviewer_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    reviewer_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    period_id VARCHAR(64) REFERENCES performance_periods(id) ON DELETE SET NULL,
    review_period VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (
        status IN ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')
    ),
    approval_state VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        approval_state IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED')
    ),
    rating NUMERIC(3, 2) CHECK (rating IS NULL OR (rating >= 1.00 AND rating <= 5.00)),
    score NUMERIC(5, 2) CHECK (score IS NULL OR (score >= 0.00 AND score <= 100.00)),
    feedback TEXT DEFAULT '',
    self_comments TEXT DEFAULT '',
    reviewer_comments TEXT DEFAULT '',
    rejection_reason TEXT DEFAULT '',
    review_date DATE DEFAULT CURRENT_DATE,
    submitted_at TIMESTAMPTZ DEFAULT NULL,
    reviewed_at TIMESTAMPTZ DEFAULT NULL,
    approved_at TIMESTAMPTZ DEFAULT NULL,
    rejected_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicate performance records for the same employee and review period
    CONSTRAINT uk_perf_records_emp_period UNIQUE (employee_id, review_period),

    -- Consistency checks
    CONSTRAINT chk_perf_records_approved CHECK (status != 'APPROVED' OR approved_at IS NOT NULL),
    CONSTRAINT chk_perf_records_rejected CHECK (status != 'REJECTED' OR rejection_reason != '')
);

DROP TRIGGER IF EXISTS trg_performance_records_updated_at ON performance_records;
CREATE TRIGGER trg_performance_records_updated_at
BEFORE UPDATE ON performance_records
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance records
CREATE INDEX IF NOT EXISTS idx_perf_records_org ON performance_records(org_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_employee ON performance_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_reviewer ON performance_records(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_reviewer_user ON performance_records(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_period_id ON performance_records(period_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_period ON performance_records(review_period);
CREATE INDEX IF NOT EXISTS idx_perf_records_status ON performance_records(status);
CREATE INDEX IF NOT EXISTS idx_perf_records_approval_state ON performance_records(approval_state);

-- 4. Performance Goals / KPIs Table
CREATE TABLE IF NOT EXISTS performance_goals (
    id VARCHAR(64) PRIMARY KEY,
    performance_record_id VARCHAR(64) NOT NULL REFERENCES performance_records(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    metric_target VARCHAR(255) DEFAULT '',
    metric_achieved VARCHAR(255) DEFAULT '',
    weightage NUMERIC(5, 2) DEFAULT 0.00 CHECK (weightage >= 0.00 AND weightage <= 100.00),
    rating NUMERIC(3, 2) CHECK (rating IS NULL OR (rating >= 1.00 AND rating <= 5.00)),
    status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS' CHECK (
        status IN ('NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'PARTIALLY_ACHIEVED', 'MISSED', 'EXCEEDED')
    ),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_performance_goals_updated_at ON performance_goals;
CREATE TRIGGER trg_performance_goals_updated_at
BEFORE UPDATE ON performance_goals
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_perf_goals_record ON performance_goals(performance_record_id);
CREATE INDEX IF NOT EXISTS idx_perf_goals_employee ON performance_goals(employee_id);
CREATE INDEX IF NOT EXISTS idx_perf_goals_status ON performance_goals(status);

-- 5. Performance Review / Approval Workflow History Table
CREATE TABLE IF NOT EXISTS performance_review_history (
    id VARCHAR(64) PRIMARY KEY,
    performance_record_id VARCHAR(64) NOT NULL REFERENCES performance_records(id) ON DELETE CASCADE,
    actor_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    action VARCHAR(50) NOT NULL CHECK (
        action IN ('CREATED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')
    ),
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    comments TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_perf_history_record ON performance_review_history(performance_record_id);
CREATE INDEX IF NOT EXISTS idx_perf_history_actor ON performance_review_history(actor_user_id);

-- 6. Seed Permissions for Phase 6 Performance Management
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-perf-read', 'performance:read', 'View Performance', 'performance', 'View performance appraisals and ratings', NOW(), NOW()),
  ('perm-perf-write', 'performance:write', 'Submit Performance Review', 'performance', 'Create self-reviews and manager evaluations', NOW(), NOW()),
  ('perm-perf-manage', 'performance:manage', 'Manage Performance Cycles', 'performance', 'Approve reviews and manage performance cycles', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map permissions to Roles (Admin, HR, Manager, Employee)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- Full management for Admin and HR
  (LOWER(r.name) IN ('admin', 'superadmin', 'hr', 'hrmanager') AND p.code IN ('performance:read', 'performance:write', 'performance:manage'))
  -- Manager can view and write reviews
  OR (LOWER(r.name) = 'manager' AND p.code IN ('performance:read', 'performance:write'))
  -- Regular Employee can view and write self-reviews
  OR (LOWER(r.name) = 'employee' AND p.code IN ('performance:read', 'performance:write'))
ON CONFLICT (role_id, permission_id) DO NOTHING;
