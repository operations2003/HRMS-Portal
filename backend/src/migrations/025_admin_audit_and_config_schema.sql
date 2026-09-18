-- =====================================================================
-- Migration 025: Phase 7 Admin APIs, RBAC Management & Audit Schema
-- Database: PostgreSQL 17+
-- =====================================================================

-- 1. Create Admin Audit Logs Table (Immutable Sensitive Action Audit Log)
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    actor_user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    actor_role VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL CHECK (
        target_type IN ('USER', 'ROLE', 'PERMISSION', 'CONFIG', 'SYSTEM')
    ),
    target_id VARCHAR(64) NOT NULL,
    action VARCHAR(50) NOT NULL CHECK (
        action IN (
            'CREATE_USER',
            'UPDATE_USER',
            'SET_USER_STATUS',
            'ASSIGN_ROLE',
            'REVOKE_ROLE',
            'CREATE_ROLE',
            'UPDATE_ROLE',
            'ASSIGN_PERMISSION',
            'REVOKE_PERMISSION',
            'UPDATE_CONFIG',
            'SECURITY_POLICY_UPDATE'
        )
    ),
    previous_value JSONB DEFAULT NULL,
    new_value JSONB DEFAULT NULL,
    reason TEXT DEFAULT '',
    ip_address VARCHAR(45) DEFAULT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fast querying of audit logs
CREATE INDEX IF NOT EXISTS idx_admin_audit_org ON admin_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor ON admin_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target ON admin_audit_logs(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_logs(created_at DESC);


-- 2. Create Admin Configurations Table (Phase 7 Administrative Settings)
CREATE TABLE IF NOT EXISTS admin_configurations (
    id VARCHAR(64) PRIMARY KEY,
    org_id VARCHAR(64) NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    config_key VARCHAR(100) NOT NULL,
    config_value JSONB NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'EXIT_OFFBOARDING' CHECK (
        category IN ('EXIT_OFFBOARDING', 'SECURITY_RBAC', 'PAYROLL', 'GENERAL')
    ),
    description TEXT DEFAULT '',
    updated_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_admin_config_org_key UNIQUE (org_id, config_key)
);

-- Trigger for admin_configurations updated_at
DROP TRIGGER IF EXISTS trg_admin_configurations_updated_at ON admin_configurations;
CREATE TRIGGER trg_admin_configurations_updated_at
BEFORE UPDATE ON admin_configurations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Indexes for configurations
CREATE INDEX IF NOT EXISTS idx_admin_config_org ON admin_configurations(org_id);
CREATE INDEX IF NOT EXISTS idx_admin_config_cat ON admin_configurations(category);


-- 3. Register Phase 7 Administrative RBAC Permissions
INSERT INTO permissions (id, code, name, module, description, created_at, updated_at)
VALUES
    ('perm-admin-read', 'admin:read', 'View Admin Console', 'admin', 'Access administrative dashboard, audit logs, and configurations', NOW(), NOW()),
    ('perm-admin-write', 'admin:write', 'Manage System Settings', 'admin', 'Update organizational configurations and administrative parameters', NOW(), NOW()),
    ('perm-admin-rbac', 'admin:rbac', 'Manage Roles & Permissions', 'admin', 'Authorized control of user roles, role definitions, and permission grants', NOW(), NOW())
ON CONFLICT (code) DO NOTHING;

-- Map Admin Permissions to Admin Roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE 
    (r.name IN ('Admin', 'ADMIN', 'SuperAdmin', 'OrgAdmin') AND p.code IN (
        'admin:read', 'admin:write', 'admin:rbac'
    ))
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Seed Default Phase 7 Administrative Configurations for Existing Organizations
INSERT INTO admin_configurations (id, org_id, config_key, config_value, category, description, created_at, updated_at)
SELECT 
    'cfg-exit-policy-' || o.id,
    o.id,
    'exit_policy',
    '{"standardNoticePeriodDays": 30, "allowSelfWithdrawal": true, "requireManagerReview": true, "requireHrApproval": true, "defaultExitType": "VOLUNTARY"}'::jsonb,
    'EXIT_OFFBOARDING',
    'Standard organizational resignation and offboarding workflow rules',
    NOW(),
    NOW()
FROM organizations o
ON CONFLICT (org_id, config_key) DO NOTHING;

INSERT INTO admin_configurations (id, org_id, config_key, config_value, category, description, created_at, updated_at)
SELECT 
    'cfg-clearance-' || o.id,
    o.id,
    'clearance_defaults',
    '{"autoProvisionTasks": true, "requiredDepartments": ["IT", "FINANCE", "ADMIN", "HR", "MANAGER"], "allowWaiving": true}'::jsonb,
    'EXIT_OFFBOARDING',
    'Default departmental clearance checklist automation rules',
    NOW(),
    NOW()
FROM organizations o
ON CONFLICT (org_id, config_key) DO NOTHING;

INSERT INTO admin_configurations (id, org_id, config_key, config_value, category, description, created_at, updated_at)
SELECT 
    'cfg-rehire-' || o.id,
    o.id,
    'rehire_policy',
    '{"eligibleByDefault": true, "coolingPeriodMonths": 6, "requireManagerRecommendation": true}'::jsonb,
    'EXIT_OFFBOARDING',
    'Organizational rehire eligibility criteria and cooling period rules',
    NOW(),
    NOW()
FROM organizations o
ON CONFLICT (org_id, config_key) DO NOTHING;
