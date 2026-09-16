-- =====================================================================
-- Migration 014: Phase 5 Helpdesk / Ticket Database Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Helpdesk Tickets Table
CREATE TABLE IF NOT EXISTS helpdesk_tickets (
    id VARCHAR(64) PRIMARY KEY,
    ticket_number VARCHAR(64) NOT NULL UNIQUE,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    employee_id VARCHAR(64) NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
    category VARCHAR(50) NOT NULL CHECK (
        category IN (
            'HR',
            'PAYROLL',
            'LEAVE_ATTENDANCE',
            'DOCUMENT',
            'IT_SUPPORT',
            'GENERAL',
            'OTHER'
        )
    ),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (
        priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')
    ),
    status VARCHAR(30) NOT NULL DEFAULT 'OPEN' CHECK (
        status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED')
    ),
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    assigned_team VARCHAR(50) DEFAULT '',
    resolution TEXT DEFAULT '',
    resolved_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMPTZ DEFAULT NULL,
    closed_at TIMESTAMPTZ DEFAULT NULL,
    attachment_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Consistency constraints
    CONSTRAINT chk_helpdesk_tickets_resolved CHECK (
        status NOT IN ('RESOLVED', 'CLOSED') OR resolved_at IS NOT NULL
    ),
    CONSTRAINT chk_helpdesk_tickets_closed CHECK (
        status != 'CLOSED' OR closed_at IS NOT NULL
    )
);

DROP TRIGGER IF EXISTS trg_helpdesk_tickets_updated_at ON helpdesk_tickets;
CREATE TRIGGER trg_helpdesk_tickets_updated_at
BEFORE UPDATE ON helpdesk_tickets
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Performance & Relational Indexes
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_org ON helpdesk_tickets(org_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_employee ON helpdesk_tickets(employee_id);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_number ON helpdesk_tickets(ticket_number);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_status ON helpdesk_tickets(status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_priority ON helpdesk_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_category ON helpdesk_tickets(category);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_assigned ON helpdesk_tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_org_status ON helpdesk_tickets(org_id, status);
CREATE INDEX IF NOT EXISTS idx_helpdesk_tickets_created ON helpdesk_tickets(created_at DESC);


-- 2. Create Ticket Comments Table (Conversation & Resolution Thread)
-- Supports historical audit trail and notification triggers on ticket updates
CREATE TABLE IF NOT EXISTS ticket_comments (
    id VARCHAR(64) PRIMARY KEY,
    ticket_id VARCHAR(64) NOT NULL REFERENCES helpdesk_tickets(id) ON DELETE RESTRICT,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    comment TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_ticket_comments_updated_at ON ticket_comments;
CREATE TRIGGER trg_ticket_comments_updated_at
BEFORE UPDATE ON ticket_comments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_org ON ticket_comments(org_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_user ON ticket_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created ON ticket_comments(created_at ASC);


-- 3. Register Phase 5 Helpdesk Permissions in RBAC Framework
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
    ('perm-helpdesk-read', 'helpdesk:read', 'View Helpdesk Tickets', 'helpdesk', 'View helpdesk tickets and comment threads', NOW(), NOW()),
    ('perm-helpdesk-write', 'helpdesk:write', 'Create / Comment Tickets', 'helpdesk', 'Submit helpdesk tickets and post replies', NOW(), NOW()),
    ('perm-helpdesk-manage', 'helpdesk:manage', 'Manage & Resolve Tickets', 'helpdesk', 'Assign, update status, resolve and close helpdesk tickets', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Helpdesk Permissions to Core Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
    -- Admin & HR have full ticket management authority
    (r.name IN ('Admin', 'HR') AND p.code IN ('helpdesk:read', 'helpdesk:write', 'helpdesk:manage'))
    OR
    -- Managers can view and submit helpdesk tickets
    (r.name = 'Manager' AND p.code IN ('helpdesk:read', 'helpdesk:write'))
    OR
    -- Employees can view and submit their own helpdesk tickets
    (r.name = 'Employee' AND p.code IN ('helpdesk:read', 'helpdesk:write'))
ON CONFLICT DO NOTHING;

