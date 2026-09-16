-- =====================================================================
-- Migration 015: Phase 5 Employee Request Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Employee Requests Table
CREATE TABLE IF NOT EXISTS employee_requests (
    id VARCHAR(64) PRIMARY KEY,
    request_number VARCHAR(64) NOT NULL UNIQUE,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    request_type VARCHAR(50) NOT NULL CHECK (
        request_type IN (
            'DOCUMENT_REQUEST',
            'HR_REQUEST',
            'PAYROLL_CLARIFICATION',
            'EMPLOYEE_SERVICE',
            'OTHER'
        )
    ),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN ('PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'CANCELLED')
    ),
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
        priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    ),
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    assigned_team VARCHAR(50) DEFAULT '',
    response_notes TEXT DEFAULT '',
    resolved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    rejection_reason TEXT DEFAULT '',
    document_vault_id VARCHAR(64) REFERENCES document_vault(id) ON DELETE SET NULL,
    attachment_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Consistency checks
    CONSTRAINT chk_employee_request_resolved CHECK (
        status != 'RESOLVED' OR resolved_at IS NOT NULL
    ),
    CONSTRAINT chk_employee_request_rejected CHECK (
        status != 'REJECTED' OR rejection_reason != ''
    )
);

DROP TRIGGER IF EXISTS trg_employee_requests_updated_at ON employee_requests;
CREATE TRIGGER trg_employee_requests_updated_at
BEFORE UPDATE ON employee_requests
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Performance & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_employee_requests_org ON employee_requests(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_employee ON employee_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_requests_number ON employee_requests(request_number);
CREATE INDEX IF NOT EXISTS idx_employee_requests_type ON employee_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_employee_requests_status ON employee_requests(status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_priority ON employee_requests(priority);
CREATE INDEX IF NOT EXISTS idx_employee_requests_assigned ON employee_requests(assigned_to);
CREATE INDEX IF NOT EXISTS idx_employee_requests_org_status ON employee_requests(org_id, status);
CREATE INDEX IF NOT EXISTS idx_employee_requests_created ON employee_requests(created_at DESC);


-- 2. Create Employee Request Updates Table (Conversation & Notification Source)
-- Tracks clarifications, employee replies, and HR updates
CREATE TABLE IF NOT EXISTS employee_request_updates (
    id VARCHAR(64) PRIMARY KEY,
    request_id VARCHAR(64) NOT NULL REFERENCES employee_requests(id) ON DELETE RESTRICT,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    message TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_employee_request_updates_updated_at ON employee_request_updates;
CREATE TRIGGER trg_employee_request_updates_updated_at
BEFORE UPDATE ON employee_request_updates
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_emp_req_updates_request ON employee_request_updates(request_id);
CREATE INDEX IF NOT EXISTS idx_emp_req_updates_org ON employee_request_updates(org_id);
CREATE INDEX IF NOT EXISTS idx_emp_req_updates_user ON employee_request_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_emp_req_updates_created ON employee_request_updates(created_at ASC);


-- 3. Register Phase 5 Employee Request Permissions in RBAC Framework
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
    ('perm-request-read', 'request:read', 'View Employee Requests', 'request', 'View employee service requests and status', NOW(), NOW()),
    ('perm-request-write', 'request:write', 'Submit Employee Requests', 'request', 'Submit service requests and post messages', NOW(), NOW()),
    ('perm-request-manage', 'request:manage', 'Manage & Resolve Requests', 'request', 'Assign, respond, resolve or reject employee requests', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Employee Request Permissions to Core Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
    -- Admin & HR have complete employee request management authority
    (r.name IN ('Admin', 'HR') AND p.code IN ('request:read', 'request:write', 'request:manage'))
    OR
    -- Managers can view and submit requests
    (r.name = 'Manager' AND p.code IN ('request:read', 'request:write'))
    OR
    -- Employees can view and submit their own service requests
    (r.name = 'Employee' AND p.code IN ('request:read', 'request:write'))
ON CONFLICT DO NOTHING;

