-- =====================================================================
-- Migration 024: Phase 7 Exit & Offboarding Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================
-- Preserves existing Phase 1-6 architecture:
-- Users, Organizations, Departments, Designations, Employees, 
-- Manager relationships, Attendance, Leave, Payroll, Payslips,
-- Document Vault, Helpdesk, Approval Workflows, and Notifications.
-- =====================================================================

-- 1. Extend approval_workflows entity_type, current_stage, and current_status check constraints
ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_entity_type_check;
ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_entity_type_check CHECK (
    entity_type IN ('PERFORMANCE_REVIEW', 'LEAVE_REQUEST', 'EMPLOYEE_REQUEST', 'EXIT_REQUEST')
);

ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_current_stage_check;
ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_current_stage_check CHECK (
    current_stage IN ('EMPLOYEE_SUBMISSION', 'MANAGER_REVIEW', 'HR_REVIEW', 'CLEARANCE_IN_PROGRESS', 'FNF_PENDING', 'COMPLETED', 'REJECTED', 'RETURNED')
);

ALTER TABLE approval_workflows DROP CONSTRAINT IF EXISTS approval_workflows_current_status_check;
ALTER TABLE approval_workflows ADD CONSTRAINT approval_workflows_current_status_check CHECK (
    current_status IN ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED', 'COMPLETED')
);

-- Extend approval_workflow_actions stage and action check constraints
ALTER TABLE approval_workflow_actions DROP CONSTRAINT IF EXISTS approval_workflow_actions_stage_check;
ALTER TABLE approval_workflow_actions ADD CONSTRAINT approval_workflow_actions_stage_check CHECK (
    stage IN ('EMPLOYEE_SUBMISSION', 'MANAGER_REVIEW', 'HR_REVIEW', 'CLEARANCE_IN_PROGRESS', 'FNF_PENDING', 'COMPLETED')
);

ALTER TABLE approval_workflow_actions DROP CONSTRAINT IF EXISTS approval_workflow_actions_action_check;
ALTER TABLE approval_workflow_actions ADD CONSTRAINT approval_workflow_actions_action_check CHECK (
    action IN ('SUBMIT', 'START_REVIEW', 'SUBMIT_REVIEW', 'REVIEW', 'APPROVE', 'REJECT', 'RETURN', 'CANCEL', 'DEPROVISION')
);


-- 2. Extend notifications event_type check constraint for Phase 7
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_event_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_event_type_check CHECK (
    event_type IN (
        -- Phase 5
        'PAYROLL_PROCESSED',
        'PAYSLIP_AVAILABLE',
        'TICKET_CREATED',
        'TICKET_STATUS_CHANGED',
        'EMPLOYEE_REQUEST_CREATED',
        'EMPLOYEE_REQUEST_STATUS_CHANGED',
        'GENERAL_ALERT',
        -- Phase 6
        'PERFORMANCE_REVIEW_PENDING',
        'PERFORMANCE_APPROVED',
        'PERFORMANCE_RETURNED',
        'PERFORMANCE_REJECTED',
        'LEAVE_APPROVAL_PENDING',
        'LEAVE_APPROVED',
        'LEAVE_REJECTED',
        'MANAGER_ASSIGNED',
        -- Phase 7
        'RESIGNATION_SUBMITTED',
        'EXIT_REVIEW_PENDING',
        'EXIT_APPROVED',
        'EXIT_REJECTED',
        'CLEARANCE_TASK_ASSIGNED',
        'CLEARANCE_TASK_COMPLETED',
        'DEPROVISIONING_EXECUTED',
        'FNF_SETTLEMENT_PROCESSED',
        'EXIT_COMPLETED'
    )
);


-- 3. Create Exit Requests Table (Primary Resignation & Core Exit Lifecycle)
CREATE TABLE IF NOT EXISTS exit_requests (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    resignation_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notice_period_days INT NOT NULL DEFAULT 30 CHECK (notice_period_days >= 0),
    requested_last_working_day DATE NOT NULL,
    approved_last_working_day DATE DEFAULT NULL,
    exit_type VARCHAR(50) NOT NULL DEFAULT 'VOLUNTARY' CHECK (
        exit_type IN ('VOLUNTARY', 'INVOLUNTARY', 'RETIREMENT', 'MUTUAL', 'CONTRACT_END')
    ),
    reason TEXT NOT NULL,
    comments TEXT DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED' CHECK (
        status IN (
            'SUBMITTED',
            'UNDER_REVIEW',
            'APPROVED',
            'NOTICE_PERIOD',
            'EXIT_PROCESSING',
            'COMPLETED',
            'CANCELLED',
            'REJECTED',
            'WITHDRAWN'
        )
    ),
    current_stage VARCHAR(50) NOT NULL DEFAULT 'MANAGER_REVIEW' CHECK (
        current_stage IN (
            'EMPLOYEE_SUBMISSION',
            'MANAGER_REVIEW',
            'HR_REVIEW',
            'CLEARANCE_IN_PROGRESS',
            'FNF_PENDING',
            'COMPLETED',
            'REJECTED',
            'WITHDRAWN',
            'CANCELLED'
        )
    ),
    submitted_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    reviewed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    approved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    manager_feedback TEXT DEFAULT '',
    manager_rating NUMERIC(3, 2) DEFAULT NULL,
    manager_rehire_eligible BOOLEAN DEFAULT TRUE,
    manager_reviewed_at TIMESTAMPTZ DEFAULT NULL,
    hr_reviewed_at TIMESTAMPTZ DEFAULT NULL,
    hr_comments TEXT DEFAULT '',
    document_id VARCHAR(64) DEFAULT NULL REFERENCES document_vault(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns and check constraints exist on exit_requests if previously created
ALTER TABLE exit_requests ADD COLUMN IF NOT EXISTS submitted_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exit_requests ADD COLUMN IF NOT EXISTS reviewed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE exit_requests ADD COLUMN IF NOT EXISTS approved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE exit_requests DROP CONSTRAINT IF EXISTS exit_requests_status_check;
ALTER TABLE exit_requests ADD CONSTRAINT exit_requests_status_check CHECK (
    status IN (
        'SUBMITTED',
        'UNDER_REVIEW',
        'APPROVED',
        'NOTICE_PERIOD',
        'EXIT_PROCESSING',
        'COMPLETED',
        'CANCELLED',
        'REJECTED',
        'WITHDRAWN'
    )
);

ALTER TABLE exit_requests DROP CONSTRAINT IF EXISTS exit_requests_current_stage_check;
ALTER TABLE exit_requests ADD CONSTRAINT exit_requests_current_stage_check CHECK (
    current_stage IN (
        'EMPLOYEE_SUBMISSION',
        'MANAGER_REVIEW',
        'HR_REVIEW',
        'CLEARANCE_IN_PROGRESS',
        'FNF_PENDING',
        'COMPLETED',
        'REJECTED',
        'WITHDRAWN',
        'CANCELLED'
    )
);

-- Trigger for exit_requests updated_at
DROP TRIGGER IF EXISTS trg_exit_requests_updated_at ON exit_requests;
CREATE TRIGGER trg_exit_requests_updated_at
BEFORE UPDATE ON exit_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for fast querying and filtering
CREATE INDEX IF NOT EXISTS idx_exit_requests_org ON exit_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_exit_requests_emp ON exit_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_exit_requests_status ON exit_requests(status);
CREATE INDEX IF NOT EXISTS idx_exit_requests_stage ON exit_requests(current_stage);
CREATE INDEX IF NOT EXISTS idx_exit_requests_created ON exit_requests(created_at);

-- Partial Unique Index: No duplicate active exit records for the same employee
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_exit_request_per_emp 
ON exit_requests (employee_id) 
WHERE status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED', 'WITHDRAWN');


-- 4. Create Exit Clearance Checklists Table (Departmental Clearances & Handover Tasks)
CREATE TABLE IF NOT EXISTS exit_clearance_checklists (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    exit_request_id VARCHAR(64) NOT NULL REFERENCES exit_requests(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    checklist_category VARCHAR(50) NOT NULL DEFAULT 'GENERAL' CHECK (
        checklist_category IN (
            'MANAGER_HANDOVER',
            'HR_CLEARANCE',
            'IT_ACCESS',
            'ASSETS_RETURNED',
            'DOCUMENTS',
            'KNOWLEDGE_TRANSFER',
            'FINANCE_PAYROLL',
            'FINAL_APPROVAL',
            'GENERAL'
        )
    ),
    department_scope VARCHAR(50) NOT NULL CHECK (
        department_scope IN ('IT', 'FINANCE', 'ADMIN', 'MANAGER', 'HR', 'OPERATIONS', 'LEGAL')
    ),
    task_title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'CLEARED', 'COMPLETED', 'REJECTED', 'WAIVED', 'NOT_APPLICABLE')
    ),
    is_required BOOLEAN NOT NULL DEFAULT TRUE,
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    cleared_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    cleared_at TIMESTAMPTZ DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    remarks TEXT DEFAULT '',
    comments TEXT DEFAULT '',
    recovery_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (recovery_amount >= 0.00),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns and check constraints exist on exit_clearance_checklists if previously created
ALTER TABLE exit_clearance_checklists ADD COLUMN IF NOT EXISTS checklist_category VARCHAR(50) NOT NULL DEFAULT 'GENERAL';
ALTER TABLE exit_clearance_checklists ADD COLUMN IF NOT EXISTS is_required BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE exit_clearance_checklists ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE exit_clearance_checklists ADD COLUMN IF NOT EXISTS comments TEXT DEFAULT '';

ALTER TABLE exit_clearance_checklists DROP CONSTRAINT IF EXISTS exit_clearance_checklists_status_check;
ALTER TABLE exit_clearance_checklists ADD CONSTRAINT exit_clearance_checklists_status_check CHECK (
    status IN ('PENDING', 'IN_PROGRESS', 'CLEARED', 'COMPLETED', 'REJECTED', 'WAIVED', 'NOT_APPLICABLE')
);

-- Trigger for exit_clearance_checklists updated_at
DROP TRIGGER IF EXISTS trg_exit_clearance_updated_at ON exit_clearance_checklists;
CREATE TRIGGER trg_exit_clearance_updated_at
BEFORE UPDATE ON exit_clearance_checklists
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for checklist query performance
CREATE INDEX IF NOT EXISTS idx_exit_clearance_org ON exit_clearance_checklists(org_id);
CREATE INDEX IF NOT EXISTS idx_exit_clearance_request ON exit_clearance_checklists(exit_request_id);
CREATE INDEX IF NOT EXISTS idx_exit_clearance_emp ON exit_clearance_checklists(employee_id);
CREATE INDEX IF NOT EXISTS idx_exit_clearance_dept ON exit_clearance_checklists(department_scope);
CREATE INDEX IF NOT EXISTS idx_exit_clearance_category ON exit_clearance_checklists(checklist_category);
CREATE INDEX IF NOT EXISTS idx_exit_clearance_status ON exit_clearance_checklists(status);


-- 5. Create Employee Offboardings Table (Dedicated Offboarding Lifecycle Record)
CREATE TABLE IF NOT EXISTS employee_offboardings (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    exit_request_id VARCHAR(64) NOT NULL UNIQUE REFERENCES exit_requests(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    last_working_day DATE NOT NULL,
    offboarding_status VARCHAR(50) NOT NULL DEFAULT 'INITIATED' CHECK (
        offboarding_status IN (
            'INITIATED',
            'IN_PROGRESS',
            'CLEARANCES_PENDING',
            'FNF_PENDING',
            'DEPROVISIONED',
            'COMPLETED',
            'CANCELLED'
        )
    ),
    clearance_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        clearance_status IN ('PENDING', 'IN_PROGRESS', 'CLEARED', 'WAIVED')
    ),
    access_removal_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (
        access_removal_status IN ('ACTIVE', 'PENDING', 'REVOKED', 'DEPROVISIONED')
    ),
    asset_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        asset_status IN ('PENDING', 'RETURNED', 'RETAINED', 'DAMAGED_DEDUCTED', 'WAIVED')
    ),
    hr_completion_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        hr_completion_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')
    ),
    completed_date DATE DEFAULT NULL,
    completed_at TIMESTAMPTZ DEFAULT NULL,
    processed_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger for employee_offboardings updated_at
DROP TRIGGER IF EXISTS trg_employee_offboardings_updated_at ON employee_offboardings;
CREATE TRIGGER trg_employee_offboardings_updated_at
BEFORE UPDATE ON employee_offboardings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for employee_offboardings
CREATE INDEX IF NOT EXISTS idx_emp_offboardings_org ON employee_offboardings(org_id);
CREATE INDEX IF NOT EXISTS idx_emp_offboardings_request ON employee_offboardings(exit_request_id);
CREATE INDEX IF NOT EXISTS idx_emp_offboardings_emp ON employee_offboardings(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_offboardings_status ON employee_offboardings(offboarding_status);


-- 6. Create Full & Final (F&F) Settlements Table (Payroll Architecture Integration)
CREATE TABLE IF NOT EXISTS fnf_settlements (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    exit_request_id VARCHAR(64) NOT NULL UNIQUE REFERENCES exit_requests(id) ON DELETE CASCADE,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    last_working_day DATE DEFAULT NULL,
    settlement_date DATE NOT NULL DEFAULT CURRENT_DATE,
    daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payable_days NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    salary_payable NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    leave_encashment_days NUMERIC(5, 1) NOT NULL DEFAULT 0.0,
    leave_encashment_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    bonus_gratuity NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    other_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    reimbursements NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    gross_payable NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    notice_period_recovery NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    asset_recovery_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    tax_deduction NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    other_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    net_settlement_amount NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (
        payment_status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PROCESSED', 'DISBURSED', 'CANCELLED')
    ),
    approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        approval_status IN ('PENDING', 'APPROVED', 'REJECTED')
    ),
    approved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ DEFAULT NULL,
    disbursed_at TIMESTAMPTZ DEFAULT NULL,
    notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns and check constraints exist on fnf_settlements if previously created
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS last_working_day DATE DEFAULT NULL;
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS daily_rate NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS other_allowances NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS reimbursements NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS gross_payable NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS other_deductions NUMERIC(14, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING';
ALTER TABLE fnf_settlements ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE fnf_settlements DROP CONSTRAINT IF EXISTS fnf_settlements_payment_status_check;
ALTER TABLE fnf_settlements ADD CONSTRAINT fnf_settlements_payment_status_check CHECK (
    payment_status IN ('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PROCESSED', 'DISBURSED', 'CANCELLED')
);

ALTER TABLE fnf_settlements DROP CONSTRAINT IF EXISTS fnf_settlements_approval_status_check;
ALTER TABLE fnf_settlements ADD CONSTRAINT fnf_settlements_approval_status_check CHECK (
    approval_status IN ('PENDING', 'APPROVED', 'REJECTED')
);

-- Trigger for fnf_settlements updated_at
DROP TRIGGER IF EXISTS trg_fnf_settlements_updated_at ON fnf_settlements;
CREATE TRIGGER trg_fnf_settlements_updated_at
BEFORE UPDATE ON fnf_settlements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for fnf settlements
CREATE INDEX IF NOT EXISTS idx_fnf_settlements_org ON fnf_settlements(org_id);
CREATE INDEX IF NOT EXISTS idx_fnf_settlements_request ON fnf_settlements(exit_request_id);
CREATE INDEX IF NOT EXISTS idx_fnf_settlements_emp ON fnf_settlements(employee_id);
CREATE INDEX IF NOT EXISTS idx_fnf_settlements_status ON fnf_settlements(payment_status);
CREATE INDEX IF NOT EXISTS idx_fnf_settlements_approval ON fnf_settlements(approval_status);


-- 7. Register Phase 7 RBAC Permissions
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
    ('perm-exit-read', 'exit:read', 'View Exit Records', 'exit', 'View own or assigned exit and offboarding records', NOW(), NOW()),
    ('perm-exit-write', 'exit:write', 'Submit / Manage Resignation', 'exit', 'Submit resignation and update clearance tasks', NOW(), NOW()),
    ('perm-exit-review', 'exit:review', 'Review Resignations', 'exit', 'Manager review and evaluation of exit requests', NOW(), NOW()),
    ('perm-exit-admin', 'exit:admin', 'Administer Exit & Offboarding', 'exit', 'Full HR administration of exit lifecycle and notice periods', NOW(), NOW()),
    ('perm-fnf-manage', 'fnf:manage', 'Manage F&F Settlements', 'exit', 'Calculate, approve, and disburse full and final settlements', NOW(), NOW()),
    ('perm-deprovision-manage', 'deprovision:manage', 'Execute Access Deprovisioning', 'exit', 'Deactivate accounts and deprovision system access', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Permissions to Core Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
    -- Admin & SuperAdmin have all Phase 7 permissions
    (r.name IN ('Admin', 'ADMIN', 'SuperAdmin', 'OrgAdmin') AND p.code IN (
        'exit:read', 'exit:write', 'exit:review', 'exit:admin', 'fnf:manage', 'deprovision:manage'
    ))
    OR
    -- HR & HRManager have full offboarding, FnF, and deprovisioning permissions
    (r.name IN ('HR', 'HRManager') AND p.code IN (
        'exit:read', 'exit:write', 'exit:review', 'exit:admin', 'fnf:manage', 'deprovision:manage'
    ))
    OR
    -- Managers can submit resignation, review team resignations, and sign off clearances
    (r.name IN ('Manager', 'MANAGER') AND p.code IN (
        'exit:read', 'exit:write', 'exit:review'
    ))
    OR
    -- Employees can view own exit records and submit resignation
    (r.name IN ('Employee', 'EMPLOYEE') AND p.code IN (
        'exit:read', 'exit:write'
    ))
ON CONFLICT DO NOTHING;


-- 8. Create Access Deprovisioning Audit Log Table
CREATE TABLE IF NOT EXISTS access_deprovisioning_audits (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    exit_request_id VARCHAR(64) NOT NULL REFERENCES exit_requests(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL DEFAULT 'DEPROVISION_ACCESS',
    previous_user_status VARCHAR(50) NOT NULL,
    new_user_status VARCHAR(50) NOT NULL,
    previous_employee_status VARCHAR(50) NOT NULL,
    new_employee_status VARCHAR(50) NOT NULL,
    reassigned_manager_id VARCHAR(64) REFERENCES employees(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deprov_audits_org ON access_deprovisioning_audits(org_id);
CREATE INDEX IF NOT EXISTS idx_deprov_audits_emp ON access_deprovisioning_audits(employee_id);
CREATE INDEX IF NOT EXISTS idx_deprov_audits_user ON access_deprovisioning_audits(user_id);
CREATE INDEX IF NOT EXISTS idx_deprov_audits_actor ON access_deprovisioning_audits(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_deprov_audits_exit ON access_deprovisioning_audits(exit_request_id);
CREATE INDEX IF NOT EXISTS idx_deprov_audits_created ON access_deprovisioning_audits(created_at);
