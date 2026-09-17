-- =====================================================================
-- Migration 021: Phase 6 Manager & HR Approval Workflow Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Extend performance_records to support multi-stage Employee -> Manager -> HR workflow
DO $$
BEGIN
    -- Add current_stage column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'performance_records' AND column_name = 'current_stage'
    ) THEN
        ALTER TABLE performance_records 
        ADD COLUMN current_stage VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE_SUBMISSION';
    END IF;

    -- Add hr_reviewer_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'performance_records' AND column_name = 'hr_reviewer_id'
    ) THEN
        ALTER TABLE performance_records 
        ADD COLUMN hr_reviewer_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL;
    END IF;

    -- Add hr_reviewer_user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'performance_records' AND column_name = 'hr_reviewer_user_id'
    ) THEN
        ALTER TABLE performance_records 
        ADD COLUMN hr_reviewer_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
    END IF;

    -- Add manager_reviewed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'performance_records' AND column_name = 'manager_reviewed_at'
    ) THEN
        ALTER TABLE performance_records 
        ADD COLUMN manager_reviewed_at TIMESTAMPTZ DEFAULT NULL;
    END IF;

    -- Add hr_reviewed_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'performance_records' AND column_name = 'hr_reviewed_at'
    ) THEN
        ALTER TABLE performance_records 
        ADD COLUMN hr_reviewed_at TIMESTAMPTZ DEFAULT NULL;
    END IF;
END $$;

-- Update constraints on performance_records for multi-stage workflow
ALTER TABLE performance_records 
DROP CONSTRAINT IF EXISTS chk_perf_records_status,
DROP CONSTRAINT IF EXISTS performance_records_status_check;

ALTER TABLE performance_records 
ADD CONSTRAINT chk_perf_records_status CHECK (
    status IN ('DRAFT', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED')
);

ALTER TABLE performance_records 
DROP CONSTRAINT IF EXISTS chk_perf_records_approval_state,
DROP CONSTRAINT IF EXISTS performance_records_approval_state_check;

ALTER TABLE performance_records 
ADD CONSTRAINT chk_perf_records_approval_state CHECK (
    approval_state IN ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED')
);

ALTER TABLE performance_records 
DROP CONSTRAINT IF EXISTS chk_perf_records_rejected;

ALTER TABLE performance_records 
ADD CONSTRAINT chk_perf_records_rejected CHECK (
    (status NOT IN ('REJECTED', 'RETURNED')) OR (rejection_reason != '')
);

-- Update action constraint on performance_review_history to include RETURNED
ALTER TABLE performance_review_history 
DROP CONSTRAINT IF EXISTS performance_review_history_action_check;

ALTER TABLE performance_review_history 
ADD CONSTRAINT performance_review_history_action_check CHECK (
    action IN ('CREATED', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED')
);

CREATE INDEX IF NOT EXISTS idx_perf_records_hr_reviewer ON performance_records(hr_reviewer_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_hr_user ON performance_records(hr_reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_perf_records_stage ON performance_records(current_stage);


-- 2. Core Approval Workflows Table (Multi-Stage Execution Instance)
CREATE TABLE IF NOT EXISTS approval_workflows (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    entity_type VARCHAR(50) NOT NULL CHECK (
        entity_type IN ('PERFORMANCE_REVIEW', 'LEAVE_REQUEST', 'EMPLOYEE_REQUEST')
    ),
    entity_id VARCHAR(64) NOT NULL,
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'EMPLOYEE_MANAGER_HR' CHECK (
        workflow_type IN ('EMPLOYEE_MANAGER_HR', 'EMPLOYEE_MANAGER', 'EMPLOYEE_HR')
    ),
    current_stage VARCHAR(50) NOT NULL DEFAULT 'MANAGER_REVIEW' CHECK (
        current_stage IN ('EMPLOYEE_SUBMISSION', 'MANAGER_REVIEW', 'HR_REVIEW', 'COMPLETED', 'REJECTED', 'RETURNED')
    ),
    current_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        current_status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED')
    ),
    requester_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    manager_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    hr_user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ DEFAULT NULL,

    -- Unique: One active workflow instance per business entity
    CONSTRAINT uk_approval_workflows_entity UNIQUE (entity_type, entity_id)
);

DROP TRIGGER IF EXISTS trg_approval_workflows_updated_at ON approval_workflows;
CREATE TRIGGER trg_approval_workflows_updated_at
BEFORE UPDATE ON approval_workflows
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for fast routing and queue queries
CREATE INDEX IF NOT EXISTS idx_approval_wf_org ON approval_workflows(org_id);
CREATE INDEX IF NOT EXISTS idx_approval_wf_entity ON approval_workflows(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_approval_wf_requester ON approval_workflows(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_wf_manager ON approval_workflows(manager_id);
CREATE INDEX IF NOT EXISTS idx_approval_wf_hr ON approval_workflows(hr_user_id);
CREATE INDEX IF NOT EXISTS idx_approval_wf_stage ON approval_workflows(current_stage);
CREATE INDEX IF NOT EXISTS idx_approval_wf_status ON approval_workflows(current_status);


-- 3. Approval Workflow Actions Table (Immutable Audit Log)
CREATE TABLE IF NOT EXISTS approval_workflow_actions (
    id VARCHAR(64) PRIMARY KEY,
    workflow_id VARCHAR(64) NOT NULL REFERENCES approval_workflows(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    stage VARCHAR(50) NOT NULL CHECK (
        stage IN ('EMPLOYEE_SUBMISSION', 'MANAGER_REVIEW', 'HR_REVIEW')
    ),
    actor_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (
        action IN ('SUBMIT', 'START_REVIEW', 'SUBMIT_REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL')
    ),
    from_status VARCHAR(50) NOT NULL,
    to_status VARCHAR(50) NOT NULL,
    comments TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit retrieval and actor verification
CREATE INDEX IF NOT EXISTS idx_wf_actions_workflow ON approval_workflow_actions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_wf_actions_entity ON approval_workflow_actions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_wf_actions_actor ON approval_workflow_actions(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_wf_actions_created ON approval_workflow_actions(created_at);


-- 4. Seed Permissions for Workflow Management
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
  ('perm-wf-read', 'workflow:read', 'View Workflow History', 'workflow', 'View approval chains and action logs', NOW(), NOW()),
  ('perm-wf-action', 'workflow:action', 'Perform Workflow Actions', 'workflow', 'Review, approve, reject or return workflow items', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map permissions to roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
  -- Admin & HR have all workflow permissions
  (LOWER(r.name) IN ('admin', 'superadmin', 'hr', 'hrmanager') AND p.code IN ('workflow:read', 'workflow:action'))
  -- Manager can review and take actions on direct reports
  OR (LOWER(r.name) = 'manager' AND p.code IN ('workflow:read', 'workflow:action'))
  -- Employees can view workflow logs on their own requests
  OR (LOWER(r.name) = 'employee' AND p.code = 'workflow:read')
ON CONFLICT (role_id, permission_id) DO NOTHING;
