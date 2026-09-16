-- =====================================================================
-- Migration 016: Phase 5 Notification Foundation
-- Database: Supabase PostgreSQL 17+
-- =====================================================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL CHECK (
        event_type IN (
            'PAYROLL_PROCESSED',
            'PAYSLIP_AVAILABLE',
            'TICKET_CREATED',
            'TICKET_STATUS_CHANGED',
            'EMPLOYEE_REQUEST_CREATED',
            'EMPLOYEE_REQUEST_STATUS_CHANGED',
            'GENERAL_ALERT'
        )
    ),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_type VARCHAR(50) NOT NULL, -- e.g. PAYROLL_PERIOD, PAYSLIP, HELPDESK_TICKET, EMPLOYEE_REQUEST
    entity_id VARCHAR(64) NOT NULL,
    action_url VARCHAR(255) DEFAULT '',
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookup indexes for unread count, recipient listing, and entity tracking
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_org ON notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_notifications_entity ON notifications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_event_type ON notifications(event_type);


-- 2. Register Phase 5 Notification Permissions in RBAC Framework
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
    ('perm-notif-read', 'notification:read', 'View Own Notifications', 'notification', 'View in-app notification center and mark items as read', NOW(), NOW()),
    ('perm-notif-write', 'notification:write', 'Dispatch System Notifications', 'notification', 'Send in-app notifications and alerts', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Notification Permissions to Core Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
    -- Admin and HR can dispatch and view notifications
    (r.name IN ('Admin', 'HR') AND p.code IN ('notification:read', 'notification:write'))
    OR
    -- Managers can view and dispatch team notifications
    (r.name = 'Manager' AND p.code IN ('notification:read', 'notification:write'))
    OR
    -- Employees can view and mark their own notifications as read
    (r.name = 'Employee' AND p.code IN ('notification:read'))
ON CONFLICT DO NOTHING;

